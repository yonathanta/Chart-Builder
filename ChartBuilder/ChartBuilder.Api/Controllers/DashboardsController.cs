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

    [HttpGet("{dashboardId:guid}/embed")]
    [HttpGet("{dashboardId:guid}/share-html")]
    public async Task<IActionResult> Embed(Guid dashboardId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var dashboard = await _dbContext.Dashboards
            .Include(d => d.Project)
            .Include(d => d.DashboardCharts)
                .ThenInclude(lc => lc.Chart)
            .FirstOrDefaultAsync(candidate => candidate.Id == dashboardId, cancellationToken);

        if (dashboard is null)
        {
            return NotFound();
        }

        if (dashboard.Project?.UserId != userId)
        {
            return Unauthorized();
        }

        // Fetch datasets for all charts
        var datasetIds = dashboard.DashboardCharts
            .Where(lc => lc.Chart != null)
            .Select(lc => lc.Chart!.DatasetId)
            .Distinct()
            .ToList();

        var datasets = await _dbContext.Datasets
            .Where(ds => datasetIds.Contains(ds.Id))
            .ToDictionaryAsync(ds => ds.Id, ds => ds.DataJson, cancellationToken);

        var chartLayouts = dashboard.DashboardCharts
            .OrderBy(lc => lc.Id)
            .Select(lc => new
            {
                lc.Id,
                lc.PositionX,
                lc.PositionY,
                lc.Width,
                lc.Height,
                Chart = lc.Chart != null ? new
                {
                    lc.Chart.Id,
                    lc.Chart.Name,
                    lc.Chart.ChartType,
                    lc.Chart.ConfigJson,
                    lc.Chart.StyleJson,
                    DataJson = datasets.ContainsKey(lc.Chart.DatasetId) ? datasets[lc.Chart.DatasetId] : "[]"
                } : null
            })
            .ToList();

        var html = GenerateDashboardHtml(dashboard.Name, chartLayouts);
        return Content(html, "text/html");
    }

    private string GenerateDashboardHtml(string title, object layouts)
    {
        var layoutsJson = System.Text.Json.JsonSerializer.Serialize(layouts);
        
        // Try to read chart-renderer.js
        string rendererJs = "// Chart Renderer not found";
        try 
        {
            var path = Path.Combine(Directory.GetCurrentDirectory(), "..", "chart-platform", "public", "chart-renderer.js");
            if (System.IO.File.Exists(path))
            {
                rendererJs = System.IO.File.ReadAllText(path);
            }
        }
        catch {}

        return $@"<!DOCTYPE html>
<html lang=""en"">
<head>
    <meta charset=""UTF-8"">
    <meta name=""viewport"" content=""width=device-width, initial-scale=1.0"">
    <title>{title}</title>
    <script src=""https://d3js.org/d3.v7.min.js""></script>
    <style>
        body {{ font-family: sans-serif; margin: 0; padding: 20px; background: #f8fafc; }}
        .dashboard-container {{ 
            display: grid; 
            grid-template-columns: repeat(12, 1fr); 
            gap: 20px; 
            max-width: 1200px; 
            margin: 0 auto; 
        }}
        @media (max-width: 1024px) {{ .dashboard-container {{ grid-template-columns: repeat(6, 1fr); }} }}
        @media (max-width: 640px) {{ .dashboard-container {{ grid-template-columns: 1fr; }} }}
        .chart-wrapper {{ 
            background: white; 
            border-radius: 8px; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
            padding: 15px; 
            min-height: 300px;
            display: flex;
            flex-direction: column;
        }}
        .chart-svg {{ width: 100%; height: 100%; display: block; }}
        .chart-title {{ font-size: 1.125rem; font-weight: 600; margin-bottom: 12px; color: #1e293b; }}
    </style>
</head>
<body>
    <h1 style=""text-align: center; color: #1e293b;"">{title}</h1>
    <div id=""dashboard"" class=""dashboard-container""></div>

    <script>
        {rendererJs}
        
        const layouts = {layoutsJson};
        const dashboard = document.getElementById('dashboard');

        layouts.forEach(layout => {{
            if (!layout.Chart) return;
            
            const div = document.createElement('div');
            div.className = 'chart-wrapper';
            
            const colSpan = Math.max(1, Math.min(12, Math.floor((layout.Width || 400) / 100)));
            div.style.gridColumn = ""span "" + colSpan;
            
            const title = document.createElement('div');
            title.className = 'chart-title';
            title.innerText = layout.Chart.Name;
            div.appendChild(title);

            const canvasDiv = document.createElement('div');
            canvasDiv.style.flex = '1';
            canvasDiv.style.minHeight = '0';
            const svg = document.createElementNS(""http://www.w3.org/2000/svg"", ""svg"");
            svg.className = 'chart-svg';
            canvasDiv.appendChild(svg);
            div.appendChild(canvasDiv);
            
            dashboard.appendChild(div);

            const config = JSON.parse(layout.Chart.ConfigJson || '{{}}');
            const data = JSON.parse(layout.Chart.DataJson || '[]');

            function doRender() {{
                const rect = canvasDiv.getBoundingClientRect();
                if (rect.width > 0) {{
                    window.ChartRenderer.render(svg, data, config, {{ width: rect.width, height: rect.height || 300 }});
                }}
            }}

            // Initial render
            setTimeout(doRender, 100);

            // Resize observation
            const ro = new ResizeObserver(() => {{
                requestAnimationFrame(doRender);
            }});
            ro.observe(canvasDiv);
        }});
    </script>
</body>
</html>";
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
}
