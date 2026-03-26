using ChartBuilder.Application.Charts.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Services;

public sealed class ChartService : IChartService
{
    private readonly AppDbContext _dbContext;
    private readonly IAuditLogService _auditLogService;

    public ChartService(AppDbContext dbContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _auditLogService = auditLogService;
    }

    public async Task<Chart> CreateAsync(Guid userId, CreateChartDto request, CancellationToken cancellationToken)
    {
        var chart = new Chart(
            name: request.Name.Trim(),
            chartType: request.ChartType.Trim(),
            configJson: request.ConfigJson.Trim(),
            styleJson: request.StyleJson.Trim(),
            datasetId: request.DatasetId,
            projectId: request.ProjectId);

        await _dbContext.Charts.AddAsync(chart, cancellationToken);

        _auditLogService.Add(
            userId: userId,
            actionType: "Chart Create",
            entityType: "Chart",
            entityId: chart.Id,
            oldValue: null,
            newValue: BuildChartSnapshot(chart));

        await _dbContext.SaveChangesAsync(cancellationToken);
        return chart;
    }

    public async Task<Chart?> UpdateAsync(Guid userId, Guid chartId, UpdateChartDto request, CancellationToken cancellationToken)
    {
        var chart = await _dbContext.Charts
            .Include(candidate => candidate.Project)
            .ThenInclude(project => project!.ProjectMembers)
            .FirstOrDefaultAsync(candidate => candidate.Id == chartId && candidate.Project != null && candidate.Project.UserId == userId, cancellationToken);

        if (chart is null || chart.Project is null)
        {
            return null;
        }

        EnsureNotPublished(chart);

        var oldValue = BuildChartSnapshot(chart);

        chart.UpdateDetails(
            name: request.Name.Trim(),
            chartType: request.ChartType.Trim(),
            configJson: request.ConfigJson.Trim(),
            styleJson: request.StyleJson.Trim(),
            datasetId: request.DatasetId);

        _auditLogService.Add(
            userId: userId,
            actionType: "Chart Update",
            entityType: "Chart",
            entityId: chart.Id,
            oldValue: oldValue,
            newValue: BuildChartSnapshot(chart));

        await _dbContext.SaveChangesAsync(cancellationToken);
        return chart;
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid chartId, CancellationToken cancellationToken)
    {
        var chart = await _dbContext.Charts
            .Include(candidate => candidate.Project)
            .ThenInclude(project => project!.ProjectMembers)
            .FirstOrDefaultAsync(candidate => candidate.Id == chartId && candidate.Project != null && candidate.Project.UserId == userId, cancellationToken);

        if (chart is null || chart.Project is null)
        {
            return false;
        }

        EnsureNotPublished(chart);

        var dashboardLinks = await _dbContext.DashboardCharts
            .Where(candidate => candidate.ChartId == chartId)
            .ToListAsync(cancellationToken);

        var reportLinks = await _dbContext.ReportCharts
            .Where(candidate => candidate.ChartId == chartId)
            .ToListAsync(cancellationToken);

        if (dashboardLinks.Count > 0)
        {
            _dbContext.DashboardCharts.RemoveRange(dashboardLinks);
        }

        if (reportLinks.Count > 0)
        {
            _dbContext.ReportCharts.RemoveRange(reportLinks);
        }

        _dbContext.Charts.Remove(chart);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<Chart?> UpdateStatusAsync(
        Guid userId,
        UserRole userRole,
        Guid chartId,
        ChartStatus targetStatus,
        CancellationToken cancellationToken)
    {
        var chart = await _dbContext.Charts
            .Include(candidate => candidate.Project)
            .ThenInclude(project => project!.ProjectMembers)
            .FirstOrDefaultAsync(candidate => candidate.Id == chartId && candidate.Project != null && candidate.Project.UserId == userId, cancellationToken);

        if (chart is null || chart.Project is null)
        {
            return null;
        }

        EnsureStatusTransitionAllowed(chart.Status, targetStatus, userRole);

        var oldStatus = chart.Status;

        chart.UpdateStatus(targetStatus);

        _auditLogService.Add(
            userId: userId,
            actionType: "Chart Status Change",
            entityType: "Chart",
            entityId: chart.Id,
            oldValue: new { status = oldStatus.ToString() },
            newValue: new { status = chart.Status.ToString() });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return chart;
    }

    private static object BuildChartSnapshot(Chart chart)
    {
        return new
        {
            chart.Name,
            chart.ChartType,
            chart.ConfigJson,
            chart.StyleJson,
            chart.DatasetId,
            chart.ProjectId,
            status = chart.Status.ToString(),
            chart.UpdatedAt,
        };
    }

    private static void EnsureCanEditChart(Project project, Guid userId)
    {
        var membershipRole = ResolveProjectRole(project, userId);

        if (membershipRole is ProjectMemberRole.Owner or ProjectMemberRole.Editor)
        {
            return;
        }

        if (membershipRole == ProjectMemberRole.Reviewer)
        {
            throw new UnauthorizedAccessException("Reviewer can change status but cannot edit chart data.");
        }

        throw new UnauthorizedAccessException("You do not have permission to modify this chart.");
    }

    private static void EnsureNotPublished(Chart chart)
    {
        if (chart.Status == ChartStatus.Published)
        {
            throw new UnauthorizedAccessException("Published charts cannot be edited unless reverted.");
        }
    }

    private static void EnsureStatusTransitionAllowed(
        ChartStatus currentStatus,
        ChartStatus targetStatus,
        UserRole userRole)
    {
        if (currentStatus == targetStatus)
        {
            return;
        }

        if (currentStatus == ChartStatus.Draft && targetStatus == ChartStatus.InReview)
        {
            if (userRole != UserRole.Reviewer)
            {
                throw new UnauthorizedAccessException("Only Reviewer can move Draft to InReview.");
            }

            return;
        }

        if (targetStatus == ChartStatus.Approved)
        {
            if (userRole is not (UserRole.Admin or UserRole.SuperAdmin or UserRole.Reviewer))
            {
                throw new UnauthorizedAccessException("Only Admin or Reviewer can approve charts.");
            }

            return;
        }

        if (targetStatus == ChartStatus.Published)
        {
            if (userRole is not (UserRole.Admin or UserRole.SuperAdmin))
            {
                throw new UnauthorizedAccessException("Only Admin can publish charts.");
            }

            return;
        }

        if (targetStatus == ChartStatus.Archived)
        {
            if (userRole is not (UserRole.Admin or UserRole.SuperAdmin))
            {
                throw new UnauthorizedAccessException("Only Admin can archive charts.");
            }

            return;
        }

        if (currentStatus == ChartStatus.Published && userRole is not (UserRole.Admin or UserRole.SuperAdmin))
        {
            throw new UnauthorizedAccessException("Only Admin can revert published charts.");
        }
    }

    private static ProjectMemberRole ResolveProjectRole(Project project, Guid userId)
    {
        if (project.UserId == userId)
        {
            return ProjectMemberRole.Owner;
        }

        var member = project.ProjectMembers.FirstOrDefault(candidate => candidate.UserId == userId);
        if (member is null)
        {
            throw new UnauthorizedAccessException("You are not a member of this project.");
        }

        return member.Role;
    }
}