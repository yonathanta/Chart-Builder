using ChartBuilder.Application.Reports.Dtos;
using ChartBuilder.Domain.Entities;

namespace ChartBuilder.Api.Services;

public interface IReportService
{
    Task<IReadOnlyList<Report>> GetByProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken);

    Task<Report?> GetByIdAsync(Guid userId, Guid reportId, CancellationToken cancellationToken);

    Task<Report> CreateAsync(Guid userId, SaveReportDto request, CancellationToken cancellationToken);

    Task<Report?> UpdateAsync(Guid userId, Guid reportId, SaveReportDto request, CancellationToken cancellationToken);
}
