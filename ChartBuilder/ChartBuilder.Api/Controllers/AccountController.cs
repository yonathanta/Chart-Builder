using ChartBuilder.Application.Auth.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Route("api/account")]
public sealed class AccountController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;
    private readonly AppDbContext _dbContext;

    public AccountController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager,
        AppDbContext dbContext)
    {
        _userManager = userManager;
        _roleManager = roleManager;
        _dbContext = dbContext;
    }

    [AllowAnonymous]
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto request)
    {
        if (!ModelState.IsValid)
        {
            return ValidationProblem(ModelState);
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var existingUser = await _userManager.FindByEmailAsync(normalizedEmail);
        if (existingUser is not null)
        {
            return BadRequest(new { error = "Email is already registered." });
        }

        var user = new ApplicationUser
        {
            UserName = normalizedEmail,
            Email = normalizedEmail,
            PhoneNumber = request.PhoneNumber.Trim(),
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Department = request.Department.Trim(),
            JobTitle = request.JobTitle.Trim(),
            IsApproved = true,
            CreatedAt = DateTime.UtcNow
        };

        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded)
        {
            return BadRequest(new
            {
                error = "Registration failed.",
                details = createResult.Errors.Select(identityError => identityError.Description)
            });
        }

        if (!await _roleManager.RoleExistsAsync("User"))
        {
            var roleResult = await _roleManager.CreateAsync(new IdentityRole("User"));
            if (!roleResult.Succeeded)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    error = "Failed to create default role.",
                    details = roleResult.Errors.Select(identityError => identityError.Description)
                });
            }
        }

        var addToRoleResult = await _userManager.AddToRoleAsync(user, "User");
        if (!addToRoleResult.Succeeded)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = "Failed to assign default role.",
                details = addToRoleResult.Errors.Select(identityError => identityError.Description)
            });
        }

        var domainUser = await _dbContext.Users
            .FirstOrDefaultAsync(candidate => candidate.Email.ToLower() == normalizedEmail);

        if (domainUser is null)
        {
            var domainUserId = Guid.TryParse(user.Id, out var parsedDomainUserId)
                ? parsedDomainUserId
                : Guid.NewGuid();

            domainUser = new User(
                id: domainUserId,
                email: normalizedEmail,
                passwordHash: string.Empty,
                fullName: $"{request.FirstName.Trim()} {request.LastName.Trim()}".Trim(),
                role: UserRole.Viewer,
                isActive: true);

            await _dbContext.Users.AddAsync(domainUser);
            await _dbContext.SaveChangesAsync();
        }

        return Ok(new
        {
            message = "Registration successful. You can now login."
        });
    }
}