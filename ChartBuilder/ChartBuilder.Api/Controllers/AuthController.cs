using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using ChartBuilder.Application.Auth.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
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
}
