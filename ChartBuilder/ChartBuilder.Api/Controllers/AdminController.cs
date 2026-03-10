using System.Security.Claims;
using ChartBuilder.Api.Services;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize(Roles = "Admin,SuperAdmin")]
[Route("api/admin")]
public sealed class AdminController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IUserService _userService;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;

    public AdminController(
        AppDbContext dbContext,
        IUserService userService,
        UserManager<ApplicationUser> userManager,
        RoleManager<IdentityRole> roleManager)
    {
        _dbContext = dbContext;
        _userService = userService;
        _userManager = userManager;
        _roleManager = roleManager;
    }

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetUsers(CancellationToken cancellationToken)
    {
        var approvalByEmail = await _userManager.Users
            .Where(user => !string.IsNullOrWhiteSpace(user.Email))
            .ToDictionaryAsync(
                user => (user.Email ?? string.Empty).ToLower(),
                user => user.IsApproved,
                cancellationToken);

        var users = await _dbContext.Users
            .OrderBy(user => user.Email)
            .Select(user => new
            {
                user.Id,
                user.Email,
                user.FullName,
                role = user.Role.ToString(),
                user.IsActive,
                user.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        var response = users.Select(user => new
        {
            user.Id,
            user.Email,
            user.FullName,
            user.role,
            user.IsActive,
            user.CreatedAt,
            isApproved = approvalByEmail.TryGetValue(user.Email.ToLower(), out var approved) ? approved : (bool?)null,
        });

        return Ok(response);
    }

    [HttpPut("users/{id:guid}/role")]
    public async Task<ActionResult<object>> UpdateUserRole(Guid id, [FromBody] UpdateUserRoleRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var actorUserId))
        {
            return Unauthorized();
        }

        var user = await _userService.ChangeUserRoleAsync(actorUserId, id, request.Role, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            user.Id,
            user.Email,
            role = user.Role.ToString(),
        });
    }

    [HttpPut("users/{id:guid}/status")]
    public async Task<ActionResult<object>> UpdateUserStatus(Guid id, [FromBody] UpdateUserStatusRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var actorUserId))
        {
            return Unauthorized();
        }

        var user = await _userService.ChangeUserStatusAsync(actorUserId, id, request.IsActive, cancellationToken);
        if (user is null)
        {
            return NotFound();
        }

        return Ok(new
        {
            user.Id,
            user.Email,
            user.IsActive,
        });
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetAuditLogs(CancellationToken cancellationToken)
    {
        var logs = await _dbContext.AuditLogs
            .OrderByDescending(log => log.Timestamp)
            .Select(log => new
            {
                log.Id,
                log.UserId,
                log.ActionType,
                log.EntityType,
                log.EntityId,
                log.Timestamp,
                log.OldValue,
                log.NewValue,
            })
            .ToListAsync(cancellationToken);

        return Ok(logs);
    }

    [HttpGet("projects")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetProjects(CancellationToken cancellationToken)
    {
        var projects = await _dbContext.Projects
            .Include(project => project.ProjectMembers)
            .OrderByDescending(project => project.UpdatedAt)
            .Select(project => new
            {
                project.Id,
                project.Name,
                project.Description,
                project.UserId,
                project.CreatedAt,
                project.UpdatedAt,
                memberCount = project.ProjectMembers.Count,
            })
            .ToListAsync(cancellationToken);

        return Ok(projects);
    }

    [HttpGet("pending-registrations")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetPendingRegistrations(CancellationToken cancellationToken)
    {
        var pendingUsers = await _userManager.Users
            .Where(user => !user.IsApproved)
            .OrderBy(user => user.CreatedAt)
            .Select(user => new
            {
                user.Id,
                user.Email,
                fullName = $"{user.FirstName} {user.LastName}".Trim(),
                user.Department,
                user.JobTitle,
                user.CreatedAt,
                user.IsApproved,
            })
            .ToListAsync(cancellationToken);

        return Ok(pendingUsers);
    }

    [HttpPut("users/{id}/approve")]
    public async Task<ActionResult<object>> ApproveUser(string id)
    {
        var user = await _userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        if (!user.IsApproved)
        {
            user.IsApproved = true;
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest(new
                {
                    error = "Failed to approve user.",
                    details = updateResult.Errors.Select(identityError => identityError.Description)
                });
            }
        }

        const string pendingRole = "Pending";
        if (await _userManager.IsInRoleAsync(user, pendingRole))
        {
            var removePendingResult = await _userManager.RemoveFromRoleAsync(user, pendingRole);
            if (!removePendingResult.Succeeded)
            {
                return BadRequest(new
                {
                    error = "Failed to remove pending role.",
                    details = removePendingResult.Errors.Select(identityError => identityError.Description)
                });
            }
        }

        var assignedRoles = await _userManager.GetRolesAsync(user);
        if (assignedRoles.Count == 0)
        {
            const string defaultRole = "Viewer";
            if (!await _roleManager.RoleExistsAsync(defaultRole))
            {
                var createRoleResult = await _roleManager.CreateAsync(new IdentityRole(defaultRole));
                if (!createRoleResult.Succeeded)
                {
                    return BadRequest(new
                    {
                        error = "Failed to create default role.",
                        details = createRoleResult.Errors.Select(identityError => identityError.Description)
                    });
                }
            }

            var addRoleResult = await _userManager.AddToRoleAsync(user, defaultRole);
            if (!addRoleResult.Succeeded)
            {
                return BadRequest(new
                {
                    error = "Failed to assign default role.",
                    details = addRoleResult.Errors.Select(identityError => identityError.Description)
                });
            }
        }

        var finalRoles = await _userManager.GetRolesAsync(user);
        var role = finalRoles.FirstOrDefault() ?? "Viewer";

        return Ok(new
        {
            user.Id,
            user.Email,
            role,
            user.IsApproved,
        });
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("sub");

        return Guid.TryParse(claimValue, out userId);
    }

    public sealed class UpdateUserRoleRequest
    {
        public UserRole Role { get; init; }
    }

    public sealed class UpdateUserStatusRequest
    {
        public bool IsActive { get; init; }
    }
}
