using System.Security.Claims;
using ChartBuilder.Api.Services;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
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

    public AdminController(AppDbContext dbContext, IUserService userService)
    {
        _dbContext = dbContext;
        _userService = userService;
    }

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<object>>> GetUsers(CancellationToken cancellationToken)
    {
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

        return Ok(users);
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
