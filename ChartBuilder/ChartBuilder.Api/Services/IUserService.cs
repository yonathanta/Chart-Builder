using ChartBuilder.Domain.Entities;

namespace ChartBuilder.Api.Services;

public interface IUserService
{
    Task<User?> ChangeUserRoleAsync(
        Guid actorUserId,
        Guid targetUserId,
        UserRole newRole,
        CancellationToken cancellationToken);

    Task<User?> ChangeUserStatusAsync(
        Guid actorUserId,
        Guid targetUserId,
        bool isActive,
        CancellationToken cancellationToken);
}
