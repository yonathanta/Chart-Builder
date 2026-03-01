using System.Security.Claims;
using System.Text.Json;
using ChartBuilder.Application.Charts.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ChartsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public ChartsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Chart>>> Get(CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var charts = await _dbContext.Charts
            .Where(chart => chart.Project != null && chart.Project.UserId == userId)
            .OrderByDescending(chart => chart.UpdatedAt)
            .ToListAsync(cancellationToken);

        return Ok(charts);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Chart>> GetById(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var chart = await _dbContext.Charts
            .FirstOrDefaultAsync(candidate => candidate.Id == id && candidate.Project != null && candidate.Project.UserId == userId, cancellationToken);

        if (chart is null)
        {
            return NotFound();
        }

        return Ok(chart);
    }

    [HttpPost]
    public async Task<ActionResult<Chart>> Post([FromBody] CreateChartDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!IsValidCreateRequest(request, out var errorMessage))
        {
            return BadRequest(new { message = errorMessage });
        }

        var ownsProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == request.ProjectId && project.UserId == userId, cancellationToken);

        if (!ownsProject)
        {
            return BadRequest(new { message = "Invalid project id." });
        }

        var chart = new Chart(
            name: request.Name.Trim(),
            chartType: request.ChartType.Trim(),
            configuration: request.Configuration.Trim(),
            dataset: request.Dataset.Trim(),
            projectId: request.ProjectId);

        await _dbContext.Charts.AddAsync(chart, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = chart.Id }, chart);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Chart>> Put(Guid id, [FromBody] UpdateChartDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!IsValidUpdateRequest(request, out var errorMessage))
        {
            return BadRequest(new { message = errorMessage });
        }

        var chart = await _dbContext.Charts
            .Include(candidate => candidate.Project)
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (chart is null || chart.Project is null || chart.Project.UserId != userId)
        {
            return NotFound();
        }

        chart.UpdateDetails(
            name: request.Name.Trim(),
            chartType: request.ChartType.Trim(),
            configuration: request.Configuration.Trim(),
            dataset: request.Dataset.Trim());

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(chart);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var chart = await _dbContext.Charts
            .Include(candidate => candidate.Project)
            .FirstOrDefaultAsync(candidate => candidate.Id == id, cancellationToken);

        if (chart is null || chart.Project is null || chart.Project.UserId != userId)
        {
            return NotFound();
        }

        _dbContext.Charts.Remove(chart);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok();
    }

    private static bool IsValidCreateRequest(CreateChartDto request, out string message)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            message = "Name is required.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.ChartType))
        {
            message = "ChartType is required.";
            return false;
        }

        if (!IsValidJson(request.Configuration))
        {
            message = "Configuration must be valid JSON.";
            return false;
        }

        if (!IsValidJson(request.Dataset))
        {
            message = "Dataset must be valid JSON.";
            return false;
        }

        if (request.ProjectId == Guid.Empty)
        {
            message = "ProjectId is required.";
            return false;
        }

        message = string.Empty;
        return true;
    }

    private static bool IsValidUpdateRequest(UpdateChartDto request, out string message)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            message = "Name is required.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.ChartType))
        {
            message = "ChartType is required.";
            return false;
        }

        if (!IsValidJson(request.Configuration))
        {
            message = "Configuration must be valid JSON.";
            return false;
        }

        if (!IsValidJson(request.Dataset))
        {
            message = "Dataset must be valid JSON.";
            return false;
        }

        message = string.Empty;
        return true;
    }

    private static bool IsValidJson(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            using var _ = JsonDocument.Parse(value);
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("sub");

        return Guid.TryParse(claimValue, out userId);
    }
}
