using System.Security.Claims;
using System.Text.Json;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class DashboardsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public DashboardsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPost]
    public async Task<ActionResult<DashboardDto>> Create([FromBody] CreateDashboardDto request, CancellationToken cancellationToken)
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

        var dashboard = new Dashboard(request.Name.Trim(), request.ProjectId, userId.ToString());
        await _dbContext.Dashboards.AddAsync(dashboard, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        var response = ToDashboardDto(dashboard);

        return CreatedAtAction(nameof(GetById), new { dashboardId = dashboard.Id }, response);
    }

    [HttpGet("project/{projectId:guid}")]
    public async Task<ActionResult<IReadOnlyList<DashboardDto>>> GetByProject(Guid projectId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var ownedProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == projectId && project.UserId == userId, cancellationToken);

        if (!ownedProject)
        {
            var projectExists = await _dbContext.Projects.AnyAsync(project => project.Id == projectId, cancellationToken);
            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var dashboards = await _dbContext.Dashboards
            .Where(dashboard => dashboard.ProjectId == projectId)
            .OrderByDescending(dashboard => dashboard.UpdatedAt)
            .Select(dashboard => new DashboardDto(
                dashboard.Id,
                dashboard.Name,
                dashboard.ProjectId,
                dashboard.UserId,
                dashboard.CreatedAt,
                dashboard.UpdatedAt))
            .ToListAsync(cancellationToken);

        return Ok(dashboards);
    }

    [HttpGet("{dashboardId:guid}")]
    public async Task<ActionResult<DashboardDetailsDto>> GetById(Guid dashboardId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var dashboard = await _dbContext.Dashboards
            .Where(candidate => candidate.Id == dashboardId && candidate.Project != null && candidate.Project.UserId == userId)
            .Select(candidate => new DashboardDetailsDto(
                candidate.Id,
                candidate.Name,
                candidate.ProjectId,
                candidate.UserId,
                candidate.CreatedAt,
                candidate.UpdatedAt,
                candidate.DashboardCharts
                    .OrderBy(layout => layout.Id)
                    .Select(layout => new DashboardChartLayoutDto(
                        layout.Id,
                        layout.ChartId,
                        layout.Chart != null ? layout.Chart.Name : string.Empty,
                        layout.Chart != null ? layout.Chart.DatasetId : Guid.Empty,
                        layout.Chart != null ? layout.Chart.ChartType : string.Empty,
                        layout.Chart != null ? layout.Chart.ConfigJson : string.Empty,
                        layout.Chart != null ? layout.Chart.StyleJson : string.Empty,
                        layout.PositionX,
                        layout.PositionY,
                        layout.Width,
                        layout.Height))
                    .ToList()))
            .FirstOrDefaultAsync(cancellationToken);

        if (dashboard is null)
        {
            var exists = await _dbContext.Dashboards.AnyAsync(candidate => candidate.Id == dashboardId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        return Ok(dashboard);
    }

    [HttpPut("{dashboardId:guid}")]
    public async Task<ActionResult<DashboardDto>> Update(Guid dashboardId, [FromBody] UpdateDashboardDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var dashboard = await _dbContext.Dashboards
            .Where(candidate => candidate.Id == dashboardId && candidate.Project != null && candidate.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (dashboard is null)
        {
            var exists = await _dbContext.Dashboards.AnyAsync(candidate => candidate.Id == dashboardId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        dashboard.UpdateName(request.Name.Trim());
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new DashboardDto(
            dashboard.Id,
            dashboard.Name,
            dashboard.ProjectId,
            dashboard.UserId,
            dashboard.CreatedAt,
            dashboard.UpdatedAt));
    }

    [HttpDelete("{dashboardId:guid}")]
    public async Task<IActionResult> Delete(Guid dashboardId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var dashboard = await _dbContext.Dashboards
            .Where(candidate => candidate.Id == dashboardId && candidate.Project != null && candidate.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (dashboard is null)
        {
            var exists = await _dbContext.Dashboards.AnyAsync(candidate => candidate.Id == dashboardId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        _dbContext.Dashboards.Remove(dashboard);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPost("add-chart")]
    public async Task<ActionResult<DashboardChartLayoutDto>> AddChart([FromBody] AddDashboardChartDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.DashboardId == Guid.Empty || request.ChartId == Guid.Empty)
        {
            return BadRequest(new { message = "DashboardId and ChartId are required." });
        }

        var dashboard = await _dbContext.Dashboards
            .Where(candidate => candidate.Id == request.DashboardId && candidate.Project != null && candidate.Project.UserId == userId)
            .Select(candidate => new { candidate.Id, candidate.ProjectId })
            .FirstOrDefaultAsync(cancellationToken);

        if (dashboard is null)
        {
            var dashboardExists = await _dbContext.Dashboards.AnyAsync(candidate => candidate.Id == request.DashboardId, cancellationToken);
            if (dashboardExists)
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

        if (chart.ProjectId != dashboard.ProjectId)
        {
            return BadRequest(new { message = "Chart and dashboard must belong to the same project." });
        }

        var alreadyInLayout = await _dbContext.DashboardCharts
            .AnyAsync(layout => layout.DashboardId == request.DashboardId && layout.ChartId == request.ChartId, cancellationToken);

        if (alreadyInLayout)
        {
            return Conflict(new { message = "Chart is already in this dashboard." });
        }

        var layout = new DashboardChart(
            request.DashboardId,
            request.ChartId,
            request.PositionX,
            request.PositionY,
            request.Width,
            request.Height);

        await _dbContext.DashboardCharts.AddAsync(layout, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new DashboardChartLayoutDto(
            layout.Id,
            layout.ChartId,
            chart.Name,
            chart.DatasetId,
            chart.ChartType,
            chart.ConfigJson,
            chart.StyleJson,
            layout.PositionX,
            layout.PositionY,
            layout.Width,
            layout.Height));
    }

    [HttpPut("update-chart-layout")]
    public async Task<ActionResult<DashboardChartLayoutDto>> UpdateChartLayout([FromBody] UpdateDashboardChartLayoutDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.Id == Guid.Empty)
        {
            return BadRequest(new { message = "Id is required." });
        }

        var layout = await _dbContext.DashboardCharts
            .Where(candidate => candidate.Id == request.Id && candidate.Dashboard != null && candidate.Dashboard.Project != null && candidate.Dashboard.Project.UserId == userId)
            .Include(candidate => candidate.Chart)
            .FirstOrDefaultAsync(cancellationToken);

        if (layout is null)
        {
            var exists = await _dbContext.DashboardCharts.AnyAsync(candidate => candidate.Id == request.Id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        layout.UpdateLayout(request.PositionX, request.PositionY, request.Width, request.Height);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new DashboardChartLayoutDto(
            layout.Id,
            layout.ChartId,
            layout.Chart?.Name ?? string.Empty,
            layout.Chart?.DatasetId ?? Guid.Empty,
            layout.Chart?.ChartType ?? string.Empty,
            layout.Chart?.ConfigJson ?? string.Empty,
            layout.Chart?.StyleJson ?? string.Empty,
            layout.PositionX,
            layout.PositionY,
            layout.Width,
            layout.Height));
    }

    [HttpDelete("remove-chart/{id:guid}")]
    public async Task<IActionResult> RemoveChart(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var layout = await _dbContext.DashboardCharts
            .Where(candidate => candidate.Id == id && candidate.Dashboard != null && candidate.Dashboard.Project != null && candidate.Dashboard.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (layout is null)
        {
            var exists = await _dbContext.DashboardCharts.AnyAsync(candidate => candidate.Id == id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        _dbContext.DashboardCharts.Remove(layout);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return Ok();
    }

    [HttpPost("/api/dashboard/save")]
    [HttpPost("/dashboard/save")]
    public async Task<ActionResult<DashboardStudioStateDto>> SaveStudioState([FromBody] SaveDashboardStudioStateDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.DashboardId == Guid.Empty)
        {
            return BadRequest(new { message = "DashboardId is required." });
        }

        var dashboard = await _dbContext.Dashboards
            .Where(candidate => candidate.Id == request.DashboardId && candidate.Project != null && candidate.Project.UserId == userId)
            .FirstOrDefaultAsync(cancellationToken);

        if (dashboard is null)
        {
            var exists = await _dbContext.Dashboards.AnyAsync(candidate => candidate.Id == request.DashboardId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        dashboard.UpdateStudioState(
            GetJsonOrDefault(request.Layout, "[]"),
            GetJsonOrDefault(request.Components, "[]"),
            GetJsonOrDefault(request.PageStructure, "[]"),
            GetJsonOrDefault(request.Snapshot, "{}"));

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(new DashboardStudioStateDto(
            dashboard.Id,
            dashboard.LayoutJson,
            dashboard.ComponentsJson,
            dashboard.PageStructureJson,
            dashboard.SnapshotJson,
            dashboard.UpdatedAt));
    }

    [HttpGet("/api/dashboard/load")]
    [HttpGet("/dashboard/load")]
    public async Task<ActionResult<DashboardStudioStateDto>> LoadStudioState([FromQuery] Guid dashboardId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (dashboardId == Guid.Empty)
        {
            return BadRequest(new { message = "dashboardId is required." });
        }

        var dashboard = await _dbContext.Dashboards
            .Where(candidate => candidate.Id == dashboardId && candidate.Project != null && candidate.Project.UserId == userId)
            .Select(candidate => new DashboardStudioStateDto(
                candidate.Id,
                candidate.LayoutJson,
                candidate.ComponentsJson,
                candidate.PageStructureJson,
                candidate.SnapshotJson,
                candidate.UpdatedAt))
            .FirstOrDefaultAsync(cancellationToken);

        if (dashboard is null)
        {
            var exists = await _dbContext.Dashboards.AnyAsync(candidate => candidate.Id == dashboardId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        return Ok(dashboard);
    }

    private static DashboardDto ToDashboardDto(Dashboard dashboard)
        => new(
            dashboard.Id,
            dashboard.Name,
            dashboard.ProjectId,
            dashboard.UserId,
            dashboard.CreatedAt,
            dashboard.UpdatedAt);

    private bool TryGetUserId(out Guid userId)
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return Guid.TryParse(claimValue, out userId);
    }

    private static string GetJsonOrDefault(JsonElement element, string defaultJson)
    {
        return element.ValueKind switch
        {
            JsonValueKind.Undefined => defaultJson,
            JsonValueKind.Null => defaultJson,
            _ => element.GetRawText(),
        };
    }

    public sealed record CreateDashboardDto(Guid ProjectId, string Name);

    public sealed record UpdateDashboardDto(string Name);

    public sealed record AddDashboardChartDto(
        Guid DashboardId,
        Guid ChartId,
        int PositionX,
        int PositionY,
        int Width,
        int Height);

    public sealed record UpdateDashboardChartLayoutDto(
        Guid Id,
        int PositionX,
        int PositionY,
        int Width,
        int Height);

    public sealed record DashboardDto(
        Guid Id,
        string Name,
        Guid ProjectId,
        string UserId,
        DateTime CreatedAt,
        DateTime UpdatedAt);

    public sealed record DashboardDetailsDto(
        Guid Id,
        string Name,
        Guid ProjectId,
        string UserId,
        DateTime CreatedAt,
        DateTime UpdatedAt,
        IReadOnlyList<DashboardChartLayoutDto> Charts);

    public sealed record DashboardChartLayoutDto(
        Guid Id,
        Guid ChartId,
        string ChartName,
        Guid DatasetId,
        string ChartType,
        string ConfigJson,
        string StyleJson,
        int PositionX,
        int PositionY,
        int Width,
        int Height);

    public sealed record SaveDashboardStudioStateDto(
        Guid DashboardId,
        JsonElement Layout,
        JsonElement Components,
        JsonElement PageStructure,
        JsonElement Snapshot);

    public sealed record DashboardStudioStateDto(
        Guid DashboardId,
        string LayoutJson,
        string ComponentsJson,
        string PageStructureJson,
        string SnapshotJson,
        DateTime UpdatedAt);
}
