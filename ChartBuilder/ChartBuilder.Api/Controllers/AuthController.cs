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
    private readonly IConfiguration _configuration;
    private readonly PasswordHasher<User> _passwordHasher;

    public AuthController(AppDbContext dbContext, IConfiguration configuration)
    {
        _dbContext = dbContext;
        _configuration = configuration;
        _passwordHasher = new PasswordHasher<User>();
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<ActionResult<AuthResponseDto>> Register(RegisterDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password) ||
            string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest(new { error = "Email, password, and full name are required." });
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
                fullName: request.FullName.Trim(),
                role: UserRole.User,
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
    public async Task<ActionResult<AuthResponseDto>> Login(LoginDto request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { error = "Email and password are required." });
        }

        try
        {
            var normalizedEmail = request.Email.Trim().ToLowerInvariant();

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
            return Ok(response);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(new { error = exception.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Unauthorized(new { error = "Invalid credentials." });
        }
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
            new(ClaimTypes.Role, user.Role.ToString())
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
            ExpiresAtUtc = expiresAt,
            UserId = user.Id,
            Email = user.Email,
            Role = user.Role.ToString()
        };
    }
}
