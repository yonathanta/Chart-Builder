using ChartBuilder.Application.Charts.Dtos;
using ChartBuilder.Domain.Entities;

namespace ChartBuilder.Api.Services;

public interface IChartService
{
    Task<Chart> CreateAsync(Guid userId, CreateChartDto request, CancellationToken cancellationToken);

    Task<Chart?> UpdateAsync(Guid userId, Guid chartId, UpdateChartDto request, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid userId, Guid chartId, CancellationToken cancellationToken);

    Task<Chart?> UpdateStatusAsync(
        Guid userId,
        UserRole userRole,
        Guid chartId,
        ChartStatus targetStatus,
        CancellationToken cancellationToken);
}