using System.Text.Json;
using ChartBuilder.Application.Reports.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Services;

public sealed class ReportService : IReportService
{
    private readonly AppDbContext _dbContext;

    public ReportService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Report>> GetByProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
    {
        await EnsureOwnsProjectAsync(userId, projectId, cancellationToken);

        return await _dbContext.Reports
            .Where(report => report.ProjectId == projectId)
            .OrderByDescending(report => report.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Report?> GetByIdAsync(Guid userId, Guid reportId, CancellationToken cancellationToken)
    {
        var report = await _dbContext.Reports
            .FirstOrDefaultAsync(candidate => candidate.Id == reportId, cancellationToken);

        if (report is null)
        {
            return null;
        }

        await EnsureOwnsProjectAsync(userId, report.ProjectId, cancellationToken);
        return report;
    }

    public async Task<Report> CreateAsync(Guid userId, SaveReportDto request, CancellationToken cancellationToken)
    {
        await EnsureOwnsProjectAsync(userId, request.ProjectId, cancellationToken);
        await EnsureSelectableChartsAreApprovedAsync(request.ProjectId, request.LayoutJson, cancellationToken);

        var report = new Report(
            title: request.Title.Trim(),
            metadataJson: request.MetadataJson.Trim(),
            layoutJson: request.LayoutJson.Trim(),
            projectId: request.ProjectId);

        await _dbContext.Reports.AddAsync(report, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return report;
    }

    public async Task<Report?> UpdateAsync(Guid userId, Guid reportId, SaveReportDto request, CancellationToken cancellationToken)
    {
        var report = await _dbContext.Reports
            .FirstOrDefaultAsync(candidate => candidate.Id == reportId, cancellationToken);

        if (report is null)
        {
            return null;
        }

        await EnsureOwnsProjectAsync(userId, report.ProjectId, cancellationToken);
        await EnsureSelectableChartsAreApprovedAsync(report.ProjectId, request.LayoutJson, cancellationToken);

        report.UpdateDetails(
            title: request.Title.Trim(),
            metadataJson: request.MetadataJson.Trim(),
            layoutJson: request.LayoutJson.Trim());

        await _dbContext.SaveChangesAsync(cancellationToken);
        return report;
    }

    private async Task EnsureOwnsProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
    {
        var ownsProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == projectId && project.UserId == userId, cancellationToken);

        if (!ownsProject)
        {
            throw new UnauthorizedAccessException("You do not have access to this project.");
        }
    }

    private async Task EnsureSelectableChartsAreApprovedAsync(Guid projectId, string layoutJson, CancellationToken cancellationToken)
    {
        var chartIds = ExtractChartIds(layoutJson);
        if (chartIds.Count == 0)
        {
            return;
        }

        var invalidCount = await _dbContext.Charts
            .Where(chart => chart.ProjectId == projectId && chartIds.Contains(chart.Id))
            .CountAsync(chart => chart.Status != ChartStatus.Approved && chart.Status != ChartStatus.Published, cancellationToken);

        if (invalidCount > 0)
        {
            throw new InvalidOperationException("Only approved charts can be selected for report layout.");
        }
    }

    private static HashSet<Guid> ExtractChartIds(string layoutJson)
    {
        var result = new HashSet<Guid>();

        if (string.IsNullOrWhiteSpace(layoutJson))
        {
            return result;
        }

        try
        {
            using var doc = JsonDocument.Parse(layoutJson);
            Traverse(doc.RootElement, result);
        }
        catch (JsonException)
        {
            return result;
        }

        return result;
    }

    private static void Traverse(JsonElement element, ISet<Guid> result)
    {
        switch (element.ValueKind)
        {
            case JsonValueKind.Object:
                foreach (var prop in element.EnumerateObject())
                {
                    if (prop.NameEquals("chartId") && prop.Value.ValueKind == JsonValueKind.String)
                    {
                        if (Guid.TryParse(prop.Value.GetString(), out var chartId))
                        {
                            result.Add(chartId);
                        }
                    }

                    Traverse(prop.Value, result);
                }
                break;
            case JsonValueKind.Array:
                foreach (var item in element.EnumerateArray())
                {
                    Traverse(item, result);
                }
                break;
        }
    }
}
