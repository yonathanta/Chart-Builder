using System.Security.Claims;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ReportsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public ReportsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPost]
    public async Task<ActionResult<ReportDto>> Create([FromBody] CreateReportDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.ProjectId == Guid.Empty)
        {
            return BadRequest(new { message = "ProjectId is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var project = await _dbContext.Projects
            .FirstOrDefaultAsync(candidate => candidate.Id == request.ProjectId, cancellationToken);

        if (project is null)
        {
            return NotFound();
        }

        if (project.UserId != userId)
        {
            return Unauthorized();
        }

        var report = new Report(request.Name.Trim(), request.ProjectId, userId.ToString());
        await _dbContext.Reports.AddAsync(report, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { reportId = report.Id }, ToReportDto(report));
    }

    [HttpGet("project/{projectId:guid}")]
    public async Task<ActionResult<IReadOnlyList<ReportDto>>> GetByProject(Guid projectId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var ownsProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == projectId && project.UserId == userId, cancellationToken);

        if (!ownsProject)
        {
            var projectExists = await _dbContext.Projects
                .AnyAsync(project => project.Id == projectId, cancellationToken);

            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var reports = await _dbContext.Reports
            .Where(report => report.ProjectId == projectId)
            .OrderByDescending(report => report.UpdatedAt)
            .Select(report => new ReportDto(
                report.Id,
                report.Name,
                report.ProjectId,
                report.UserId,
                report.CreatedAt,
                report.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(reports);
    }

    [HttpGet("{reportId:guid}")]
    public async Task<ActionResult<ReportDetailsDto>> GetById(Guid reportId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var report = await _dbContext.Reports
            .Where(candidate => candidate.Id == reportId && candidate.Project != null && candidate.Project.UserId == userId)
            .Select(candidate => new ReportDetailsDto(
                candidate.Id,
                candidate.Name,
                candidate.ProjectId,
                candidate.UserId,
                candidate.CreatedAt,
                candidate.UpdatedAt,
                candidate.ReportCharts
                    .OrderBy(link => link.OrderIndex)
                    .Select(link => new ReportChartDto(
                        link.Id,
                        link.ChartId,
                        link.Chart != null ? link.Chart.Name : string.Empty,
                        link.Chart != null ? link.Chart.DatasetId : Guid.Empty,
                        link.Chart != null ? link.Chart.ChartType : string.Empty,
                        link.Chart != null ? link.Chart.ConfigJson : string.Empty,
                        link.Chart != null ? link.Chart.StyleJson : string.Empty,
                        link.OrderIndex))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);

        if (report is null)
        {
            var exists = await _dbContext.Reports.AnyAsync(candidate => candidate.Id == reportId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        return Ok(report);
    }

    [HttpPut("{reportId:guid}")]
    public async Task<ActionResult<ReportDto>> Update(Guid reportId, [FromBody] UpdateReportDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var report = await _dbContext.Reports
            .Where(candidate => candidate.Id == reportId && candidate.Project != null && candidate.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (report is null)
        {
            var exists = await _dbContext.Reports.AnyAsync(candidate => candidate.Id == reportId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        report.UpdateDetails(request.Name.Trim(), report.MetadataJson, report.LayoutJson);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToReportDto(report));
    }

    [HttpDelete("{reportId:guid}")]
    public async Task<IActionResult> Delete(Guid reportId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var report = await _dbContext.Reports
            .Where(candidate => candidate.Id == reportId && candidate.Project != null && candidate.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (report is null)
        {
            var exists = await _dbContext.Reports.AnyAsync(candidate => candidate.Id == reportId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        _dbContext.Reports.Remove(report);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok();
    }

    [HttpPost("add-chart")]
    public async Task<ActionResult<ReportChartDto>> AddChart([FromBody] AddReportChartDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.ReportId == Guid.Empty || request.ChartId == Guid.Empty)
        {
            return BadRequest(new { message = "ReportId and ChartId are required." });
        }

        var report = await _dbContext.Reports
            .Where(candidate => candidate.Id == request.ReportId && candidate.Project != null && candidate.Project.UserId == userId)
            .Select(candidate => new { candidate.Id, candidate.ProjectId })
            .FirstOrDefaultAsync(cancellationToken);

        if (report is null)
        {
            var reportExists = await _dbContext.Reports.AnyAsync(candidate => candidate.Id == request.ReportId, cancellationToken);
            if (reportExists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var chart = await _dbContext.Charts
            .Where(candidate => candidate.Id == request.ChartId)
            .Select(candidate => new
            {
                candidate.Id,
                candidate.Name,
                candidate.ProjectId,
                candidate.DatasetId,
                candidate.ChartType,
                candidate.ConfigJson,
                candidate.StyleJson,
                OwnerId = candidate.Project != null ? candidate.Project.UserId : Guid.Empty
            })
            .FirstOrDefaultAsync(cancellationToken);

        if (chart is null)
        {
            return NotFound();
        }

        if (chart.OwnerId != userId)
        {
            return Unauthorized();
        }

        if (chart.ProjectId != report.ProjectId)
        {
            return BadRequest(new { message = "Chart and report must belong to the same project." });
        }

        var hasOrderConflict = await _dbContext.ReportCharts
            .AnyAsync(link => link.ReportId == request.ReportId && link.OrderIndex == request.OrderIndex, cancellationToken);

        if (hasOrderConflict)
        {
            return Conflict(new { message = "Order index already used in this report." });
        }

        var alreadyAdded = await _dbContext.ReportCharts
            .AnyAsync(link => link.ReportId == request.ReportId && link.ChartId == request.ChartId, cancellationToken);

        if (alreadyAdded)
        {
            return Conflict(new { message = "Chart is already part of this report." });
        }

        var link = new ReportChart(request.ReportId, request.ChartId, request.OrderIndex);
        await _dbContext.ReportCharts.AddAsync(link, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ReportChartDto(
            link.Id,
            link.ChartId,
            chart.Name,
            chart.DatasetId,
            chart.ChartType,
            chart.ConfigJson,
            chart.StyleJson,
            link.OrderIndex));
    }

    [HttpPut("reorder-chart")]
    public async Task<ActionResult<ReportChartDto>> ReorderChart([FromBody] ReorderReportChartDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.Id == Guid.Empty)
        {
            return BadRequest(new { message = "Id is required." });
        }

        var reportChart = await _dbContext.ReportCharts
            .Where(candidate => candidate.Id == request.Id && candidate.Report != null && candidate.Report.Project != null && candidate.Report.Project.UserId == userId)
            .Include(candidate => candidate.Chart)
            .FirstOrDefaultAsync(cancellationToken);

        if (reportChart is null)
        {
            var exists = await _dbContext.ReportCharts.AnyAsync(candidate => candidate.Id == request.Id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var orderConflict = await _dbContext.ReportCharts
            .AnyAsync(candidate => candidate.ReportId == reportChart.ReportId && candidate.Id != reportChart.Id && candidate.OrderIndex == request.OrderIndex, cancellationToken);

        if (orderConflict)
        {
            return Conflict(new { message = "Order index already used in this report." });
        }

        reportChart.UpdateOrder(request.OrderIndex);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new ReportChartDto(
            reportChart.Id,
            reportChart.ChartId,
            reportChart.Chart?.Name ?? string.Empty,
            reportChart.Chart?.DatasetId ?? Guid.Empty,
            reportChart.Chart?.ChartType ?? string.Empty,
            reportChart.Chart?.ConfigJson ?? string.Empty,
            reportChart.Chart?.StyleJson ?? string.Empty,
            reportChart.OrderIndex));
    }

    [HttpDelete("remove-chart/{id:guid}")]
    public async Task<IActionResult> RemoveChart(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var reportChart = await _dbContext.ReportCharts
            .Where(candidate => candidate.Id == id && candidate.Report != null && candidate.Report.Project != null && candidate.Report.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (reportChart is null)
        {
            var exists = await _dbContext.ReportCharts.AnyAsync(candidate => candidate.Id == id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        _dbContext.ReportCharts.Remove(reportChart);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok();
    }

    private static ReportDto ToReportDto(Report report)
        => new(
            report.Id,
            report.Name,
            report.ProjectId,
            report.UserId,
            report.CreatedAt,
            report.UpdatedAt);

    public sealed record CreateReportDto(Guid ProjectId, string Name);

    public sealed record UpdateReportDto(string Name);

    public sealed record AddReportChartDto(Guid ReportId, Guid ChartId, int OrderIndex);

    public sealed record ReorderReportChartDto(Guid Id, int OrderIndex);

    public sealed record ReportDto(
        Guid Id,
        string Name,
        Guid ProjectId,
        string UserId,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    public sealed record ReportDetailsDto(
        Guid Id,
        string Name,
        Guid ProjectId,
        string UserId,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        IReadOnlyList<ReportChartDto> Charts);

    public sealed record ReportChartDto(
        Guid Id,
        Guid ChartId,
        string ChartName,
        Guid DatasetId,
        string ChartType,
        string ConfigJson,
        string StyleJson,
        int OrderIndex);

    private bool TryGetUserId(out Guid userId)
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(claimValue, out userId);
    }
}
