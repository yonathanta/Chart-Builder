using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Services;

public sealed class OwnershipValidationService : IOwnershipValidationService
{
    private readonly AppDbContext _dbContext;

    public OwnershipValidationService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public async Task<IReadOnlyList<Project>> GetOwnedProjectsAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.Projects
            .Where(project => project.UserId == userId)
            .OrderByDescending(project => project.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Project?> GetOwnedProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
    {
        return await _dbContext.Projects
            .FirstOrDefaultAsync(project => project.Id == projectId && project.UserId == userId, cancellationToken);
    }

    public async Task<bool> OwnsProjectAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
    {
        return await _dbContext.Projects
            .AnyAsync(project => project.Id == projectId && project.UserId == userId, cancellationToken);
    }

    public async Task<IReadOnlyList<Chart>> GetOwnedChartsAsync(Guid userId, CancellationToken cancellationToken)
    {
        return await _dbContext.Charts
            .Where(chart => chart.Project != null && chart.Project.UserId == userId)
            .OrderByDescending(chart => chart.UpdatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<Chart?> GetOwnedChartAsync(Guid userId, Guid chartId, bool includeProject, CancellationToken cancellationToken)
    {
        IQueryable<Chart> query = _dbContext.Charts;

        if (includeProject)
        {
            query = query.Include(chart => chart.Project);
        }

        return await query.FirstOrDefaultAsync(
            chart => chart.Id == chartId && chart.Project != null && chart.Project.UserId == userId,
            cancellationToken);
    }
}