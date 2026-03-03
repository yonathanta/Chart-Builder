using ChartBuilder.Application.Projects.Dtos;
using ChartBuilder.Domain.Entities;

namespace ChartBuilder.Api.Services;

public interface IProjectService
{
    Task<Project?> UpdateAsync(Guid userId, Guid projectId, UpdateProjectDto request, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid userId, Guid projectId, CancellationToken cancellationToken);

    Task<ProjectMember?> AssignProjectRoleAsync(
        Guid actorUserId,
        Guid projectId,
        Guid memberUserId,
        ProjectMemberRole role,
        CancellationToken cancellationToken);
}