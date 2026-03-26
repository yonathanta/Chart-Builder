using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using ChartBuilder.Application.Auth.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class AuthController : ControllerBase
{
    private static readonly TimeSpan PasswordResetTokenLifetime = TimeSpan.FromHours(1);
    private readonly AppDbContext _dbContext;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher<User> _passwordHasher;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        AppDbContext dbContext,
        UserManager<ApplicationUser> userManager,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _dbContext = dbContext;
        _userManager = userManager;
        _configuration = configuration;
        _passwordHasher = new PasswordHasher<User>();
        _logger = logger;
    }

    [HttpPost("register")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.FirstName) ||
            string.IsNullOrWhiteSpace(request.LastName))
        {
            return BadRequest(new { error = "Email, password, first name, and last name are required." });
        }

        try
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();
            var existingUser = await _dbContext.Users
                .FirstOrDefaultAsync(user => user.Email.ToLower() == normalizedEmail, cancellationToken);

            if (existingUser is not null)
            {
                return BadRequest(new { error = "Email is already registered." });
            }

            var user = new User(
                email: request.Email.Trim(),
                passwordHash: string.Empty,
                fullName: $"{request.FirstName.Trim()} {request.LastName.Trim()}".Trim(),
                role: UserRole.Viewer,
                isActive: true);

            user.SetPasswordHash(_passwordHasher.HashPassword(user, request.Password));

            await _dbContext.Users.AddAsync(user, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var response = BuildAuthResponse(user);
            return Ok(response);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required." });
        }

        try
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

            try
            {
                var identityUser = await _userManager.FindByEmailAsync(normalizedEmail);
                if (identityUser is not null)
                {
                    var passwordValid = await _userManager.CheckPasswordAsync(identityUser, request.Password);
                    if (!passwordValid)
                    {
                        return Unauthorized(new { error = "Invalid credentials." });
                    }

                    if (!identityUser.IsApproved)
                    {
                        return Unauthorized(new { error = "Your account is pending admin approval." });
                    }

                    var userRoles = await _userManager.GetRolesAsync(identityUser);
                    var role = userRoles.FirstOrDefault(roleName => !string.Equals(roleName, "Pending", StringComparison.OrdinalIgnoreCase))
                        ?? userRoles.FirstOrDefault()
                        ?? UserRole.Viewer.ToString();

                    var domainUser = await EnsureDomainUserForIdentityAsync(identityUser, role, cancellationToken);
                    var identityResponse = BuildAuthResponse(identityUser, role, domainUser.Id);
                    return Ok(BuildLoginResponse(identityResponse));
                }
            }
            catch (Exception exception)
            {
                _logger.LogWarning(exception, "Identity login lookup failed for {Email}. Falling back to domain user auth.", normalizedEmail);
            }

            var user = await _dbContext.Users
                .FirstOrDefaultAsync(candidate => candidate.Email.ToLower() == normalizedEmail, cancellationToken);

            if (user is null || !user.IsActive)
            {
                return Unauthorized(new { error = "Invalid credentials." });
            }

            var verifyResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
            if (verifyResult == PasswordVerificationResult.Failed)
            {
                return Unauthorized(new { error = "Invalid credentials." });
            }

            var response = BuildAuthResponse(user);
            return Ok(BuildLoginResponse(response));
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Invalid credentials." });
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unhandled login failure for {Email}.", request.Email);
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = "Unable to sign in right now. Please try again."
            });
        }
    }

    [AllowAnonymous]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { error = "Email is required." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _dbContext.Users
            .FirstOrDefaultAsync(candidate => candidate.Email.ToLower() == normalizedEmail, cancellationToken);

        // Always return success to avoid email-enumeration leaks.
        if (user is null || !user.IsActive)
        {
            return Ok(new
            {
                message = "If the email exists, a reset link has been generated.",
                resetLink = (string?)null,
                expiresAtUtc = (DateTime?)null,
            });
        }

        var rawToken = GeneratePasswordResetToken();
        var tokenHash = HashToken(rawToken);
        var expiresAtUtc = DateTime.UtcNow.Add(PasswordResetTokenLifetime);

        user.SetPasswordResetToken(tokenHash, expiresAtUtc);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(rawToken));
        var resetLink = $"http://localhost:5173/#/reset-password?token={Uri.EscapeDataString(encodedToken)}";

        return Ok(new
        {
            message = "If the email exists, a reset link has been generated.",
            resetLink,
            expiresAtUtc,
        });
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { error = "Token and new password are required." });
        }

        var decodedToken = DecodeIncomingToken(request.Token);
        if (string.IsNullOrWhiteSpace(decodedToken))
        {
            return BadRequest(new { error = "Invalid or expired reset token." });
        }

        var tokenHash = HashToken(decodedToken);
        var nowUtc = DateTime.UtcNow;

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(candidate =>
                candidate.PasswordResetTokenHash == tokenHash &&
                candidate.PasswordResetTokenExpiresAtUtc.HasValue &&
                candidate.PasswordResetTokenExpiresAtUtc.Value >= nowUtc,
                cancellationToken);

        if (user is null)
        {
            return BadRequest(new { error = "Invalid or expired reset token." });
        }

        user.SetPasswordHash(_passwordHasher.HashPassword(user, request.NewPassword));
        user.ClearPasswordResetToken();

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new { message = "Password reset successful." });
    }

    private static object BuildLoginResponse(AuthResponseDto response)
    {
        return new
        {
            token = response.Token,
            user = new
            {
                id = response.UserId,
                email = response.Email,
                role = response.Role
            }
        };
    }

    private AuthResponseDto BuildAuthResponse(User user)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? string.Empty;
        var audience = _configuration["Jwt:Audience"] ?? string.Empty;
        var secretKey = _configuration["Jwt:SecretKey"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience) || string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException("JWT configuration is missing. Set Jwt:Issuer, Jwt:Audience, and Jwt:SecretKey.");
        }

        var expiresAt = DateTime.UtcNow.AddHours(1);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()),
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(ClaimTypes.Role, user.Role.ToString()),
            new("role", user.Role.ToString())
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new AuthResponseDto
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            UserId = user.Id,
            Email = user.Email,
            Role = user.Role.ToString()
        };
    }

    private AuthResponseDto BuildAuthResponse(ApplicationUser user, string role, Guid domainUserId)
    {
        var issuer = _configuration["Jwt:Issuer"] ?? string.Empty;
        var audience = _configuration["Jwt:Audience"] ?? string.Empty;
        var secretKey = _configuration["Jwt:SecretKey"] ?? string.Empty;

        if (string.IsNullOrWhiteSpace(issuer) || string.IsNullOrWhiteSpace(audience) || string.IsNullOrWhiteSpace(secretKey))
        {
            throw new InvalidOperationException("JWT configuration is missing. Set Jwt:Issuer, Jwt:Audience, and Jwt:SecretKey.");
        }

        var expiresAt = DateTime.UtcNow.AddHours(1);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, domainUserId.ToString()),
            new(ClaimTypes.NameIdentifier, domainUserId.ToString()),
            new(JwtRegisteredClaimNames.Email, user.Email ?? string.Empty),
            new(ClaimTypes.Role, role),
            new("role", role),
            new("identityUserId", user.Id)
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
            SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expiresAt,
            signingCredentials: credentials);

        return new AuthResponseDto
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            UserId = domainUserId,
            Email = user.Email ?? string.Empty,
            Role = role
        };
    }

    private async Task<User> EnsureDomainUserForIdentityAsync(
        ApplicationUser identityUser,
        string role,
        CancellationToken cancellationToken)
    {
        var normalizedEmail = (identityUser.Email ?? string.Empty).Trim().ToLowerInvariant();
        if (string.IsNullOrWhiteSpace(normalizedEmail))
        {
            throw new InvalidOperationException("Identity user is missing an email address.");
        }

        var domainUser = await _dbContext.Users
            .FirstOrDefaultAsync(user => user.Email.ToLower() == normalizedEmail, cancellationToken);

        var mappedRole = TryMapDomainRole(role, out var parsedRole)
            ? parsedRole
            : UserRole.Viewer;

        if (domainUser is null)
        {
            var fullName = $"{identityUser.FirstName} {identityUser.LastName}".Trim();
            domainUser = new User(
                id: Guid.NewGuid(),
                email: normalizedEmail,
                passwordHash: string.Empty,
                fullName: string.IsNullOrWhiteSpace(fullName) ? normalizedEmail : fullName,
                role: mappedRole,
                isActive: true);

            await _dbContext.Users.AddAsync(domainUser, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return domainUser;
        }

        var hasChanges = false;
        if (!domainUser.IsActive)
        {
            domainUser.Activate();
            hasChanges = true;
        }

        if (domainUser.Role != mappedRole)
        {
            domainUser.UpdateRole(mappedRole);
            hasChanges = true;
        }

        if (hasChanges)
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        return domainUser;
    }

    private static bool TryMapDomainRole(string role, out UserRole mappedRole)
    {
        if (Enum.TryParse<UserRole>(role, ignoreCase: true, out mappedRole))
        {
            return true;
        }

        mappedRole = UserRole.Viewer;
        return false;
    }

    private static string GeneratePasswordResetToken()
    {
        Span<byte> buffer = stackalloc byte[32];
        RandomNumberGenerator.Fill(buffer);
        return WebEncoders.Base64UrlEncode(buffer);
    }

    private static string HashToken(string token)
    {
        var bytes = Encoding.UTF8.GetBytes(token);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash);
    }

    private static string? DecodeIncomingToken(string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        // Accept already-decoded token and URL-safe base64 token from query string.
        try
        {
            var decodedBytes = WebEncoders.Base64UrlDecode(token);
            var decoded = Encoding.UTF8.GetString(decodedBytes);
            return string.IsNullOrWhiteSpace(decoded) ? null : decoded;
        }
        catch (FormatException)
        {
            return token;
        }
    }
}
