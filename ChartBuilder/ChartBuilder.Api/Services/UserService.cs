using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Services;

public sealed class UserService : IUserService
{
    private readonly AppDbContext _dbContext;
    private readonly IAuditLogService _auditLogService;

    public UserService(AppDbContext dbContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _auditLogService = auditLogService;
    }

    public async Task<User?> ChangeUserRoleAsync(
        Guid actorUserId,
        Guid targetUserId,
        UserRole newRole,
        CancellationToken cancellationToken)
    {
        EnsureActorCanManageUsers(await FindActorAsync(actorUserId, cancellationToken));

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(candidate => candidate.Id == targetUserId, cancellationToken);

        if (user is null)
        {
            return null;
        }

        var oldRole = user.Role;
        user.UpdateRole(newRole);

        _auditLogService.Add(
            userId: actorUserId,
            actionType: "User Role Change",
            entityType: "User",
            entityId: user.Id,
            oldValue: new { role = oldRole.ToString() },
            newValue: new { role = user.Role.ToString() });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return user;
    }

    public async Task<User?> ChangeUserStatusAsync(
        Guid actorUserId,
        Guid targetUserId,
        bool isActive,
        CancellationToken cancellationToken)
    {
        EnsureActorCanManageUsers(await FindActorAsync(actorUserId, cancellationToken));

        var user = await _dbContext.Users
            .FirstOrDefaultAsync(candidate => candidate.Id == targetUserId, cancellationToken);

        if (user is null)
        {
            return null;
        }

        var oldStatus = user.IsActive;

        if (isActive)
        {
            user.Activate();
        }
        else
        {
            user.Deactivate();
        }

        _auditLogService.Add(
            userId: actorUserId,
            actionType: "User Status Change",
            entityType: "User",
            entityId: user.Id,
            oldValue: new { isActive = oldStatus },
            newValue: new { isActive = user.IsActive });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return user;
    }

    private async Task<User> FindActorAsync(Guid actorUserId, CancellationToken cancellationToken)
    {
        var actor = await _dbContext.Users
            .FirstOrDefaultAsync(user => user.Id == actorUserId, cancellationToken);

        if (actor is null)
        {
            throw new UnauthorizedAccessException("Actor user was not found.");
        }

        return actor;
    }

    private static void EnsureActorCanManageUsers(User actor)
    {
        if (actor.Role is not (UserRole.Admin or UserRole.SuperAdmin))
        {
            throw new UnauthorizedAccessException("Only Admin and SuperAdmin can manage users.");
        }
    }
}
