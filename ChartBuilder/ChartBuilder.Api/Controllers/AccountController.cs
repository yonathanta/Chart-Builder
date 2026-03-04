using ChartBuilder.Application.Auth.Dtos;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Route("api/account")]
public sealed class AccountController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;

    public AccountController(
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        _userManager = userManager;
        _roleManager = roleManager;
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
            IsApproved = false,
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

        const string pendingRole = "Pending";
        if (!await _roleManager.RoleExistsAsync(pendingRole))
        {
            var roleResult = await _roleManager.CreateAsync(new IdentityRole(pendingRole));
            if (!roleResult.Succeeded)
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new
                {
                    error = "Failed to create pending role.",
                    details = roleResult.Errors.Select(identityError => identityError.Description)
                });
            }
        }

        var addToRoleResult = await _userManager.AddToRoleAsync(user, pendingRole);
        if (!addToRoleResult.Succeeded)
        {
            return StatusCode(StatusCodes.Status500InternalServerError, new
            {
                error = "Failed to assign pending role.",
                details = addToRoleResult.Errors.Select(identityError => identityError.Description)
            });
        }

        return Ok(new { message = "Registration submitted. Awaiting admin approval." });
    }
}