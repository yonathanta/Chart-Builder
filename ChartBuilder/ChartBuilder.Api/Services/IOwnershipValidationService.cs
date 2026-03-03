using ChartBuilder.Domain.Entities;

namespace ChartBuilder.Api.Services;

public interface IOwnershipValidationService
{
    Task<IReadOnlyList<Project>> GetOwnedProjectsAsync(Guid userId, CancellationToken cancellationToken);

    Task<Project?> GetOwnedProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken);

    Task<bool> OwnsProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Chart>> GetOwnedChartsAsync(Guid userId, CancellationToken cancellationToken);

    Task<Chart?> GetOwnedChartAsync(Guid userId, Guid chartId, bool includeProject, CancellationToken cancellationToken);
}