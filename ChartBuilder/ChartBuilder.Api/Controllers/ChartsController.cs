using System.Security.Claims;
using System.Text.Json;
using ChartBuilder.Api.Services;
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
    private readonly IOwnershipValidationService _ownershipValidationService;
    private readonly IChartService _chartService;

    public ChartsController(
        AppDbContext dbContext,
        IOwnershipValidationService ownershipValidationService,
        IChartService chartService)
    {
        _dbContext = dbContext;
        _ownershipValidationService = ownershipValidationService;
        _chartService = chartService;
    }

    [HttpGet]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
    public async Task<ActionResult<IReadOnlyList<Chart>>> Get(CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var charts = await _ownershipValidationService.GetOwnedChartsAsync(userId, cancellationToken);

        return Ok(charts);
    }

    [HttpGet("project/{projectId:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
    public async Task<ActionResult<IReadOnlyList<Chart>>> GetByProject(Guid projectId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var ownsProject = await _ownershipValidationService.OwnsProjectAsync(userId, projectId, cancellationToken);
        if (!ownsProject)
        {
            var projectExists = await _dbContext.Projects.AnyAsync(project => project.Id == projectId, cancellationToken);
            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound(new { message = "Project not found." });
        }

        var charts = await _dbContext.Charts
            .AsNoTracking()
            .Where(chart => chart.ProjectId == projectId)
            .OrderByDescending(chart => chart.UpdatedAt)
            .ToListAsync(cancellationToken);

        return Ok(charts);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
    public async Task<ActionResult<Chart>> GetById(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var chart = await _ownershipValidationService.GetOwnedChartAsync(userId, id, includeProject: false, cancellationToken);

        if (chart is null)
        {
            var exists = await _dbContext.Charts.AnyAsync(candidate => candidate.Id == id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        return Ok(chart);
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,User")]
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

        var ownsProject = await _ownershipValidationService.OwnsProjectAsync(userId, request.ProjectId, cancellationToken);

        if (!ownsProject)
        {
            var projectExists = await _dbContext.Projects.AnyAsync(project => project.Id == request.ProjectId, cancellationToken);
            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound(new { message = "Project not found." });
        }

        var datasetExists = await _dbContext.Datasets.AnyAsync(dataset =>
            dataset.Id == request.DatasetId &&
            dataset.ProjectId == request.ProjectId &&
            dataset.UserId == userId.ToString(), cancellationToken);

        if (!datasetExists)
        {
            return NotFound(new { message = "Dataset not found for the selected project." });
        }

        var chart = await _chartService.CreateAsync(userId, request, cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = chart.Id }, chart);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
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

        var ownedChart = await _ownershipValidationService.GetOwnedChartAsync(userId, id, includeProject: true, cancellationToken);
        if (ownedChart is null)
        {
            var exists = await _dbContext.Charts.AnyAsync(candidate => candidate.Id == id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var datasetExists = await _dbContext.Datasets.AnyAsync(dataset =>
            dataset.Id == request.DatasetId &&
            dataset.ProjectId == ownedChart.ProjectId &&
            dataset.UserId == userId.ToString(), cancellationToken);

        if (!datasetExists)
        {
            return NotFound(new { message = "Dataset not found for this chart project." });
        }

        var chart = await _chartService.UpdateAsync(userId, id, request, cancellationToken);
        if (chart is null)
        {
            return NotFound();
        }

        return Ok(chart);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var ownedChart = await _ownershipValidationService.GetOwnedChartAsync(userId, id, includeProject: false, cancellationToken);
        if (ownedChart is null)
        {
            var exists = await _dbContext.Charts.AnyAsync(candidate => candidate.Id == id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var deleted = await _chartService.DeleteAsync(userId, id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }

        return Ok();
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "SuperAdmin,Admin,Reviewer")]
    public async Task<ActionResult<Chart>> UpdateStatus(Guid id, [FromBody] UpdateChartStatusDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!TryGetUserRole(out var userRole))
        {
            return Unauthorized();
        }

        var ownedChart = await _ownershipValidationService.GetOwnedChartAsync(userId, id, includeProject: false, cancellationToken);
        if (ownedChart is null)
        {
            var exists = await _dbContext.Charts.AnyAsync(candidate => candidate.Id == id, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        var chart = await _chartService.UpdateStatusAsync(userId, userRole, id, request.Status, cancellationToken);
        if (chart is null)
        {
            return NotFound();
        }

        return Ok(chart);
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

        if (!IsValidJson(request.ConfigJson))
        {
            message = "ConfigJson must be valid JSON.";
            return false;
        }

        if (!IsValidJson(request.StyleJson))
        {
            message = "StyleJson must be valid JSON.";
            return false;
        }

        if (request.DatasetId == Guid.Empty)
        {
            message = "DatasetId is required.";
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

        if (!IsValidJson(request.ConfigJson))
        {
            message = "ConfigJson must be valid JSON.";
            return false;
        }

        if (!IsValidJson(request.StyleJson))
        {
            message = "StyleJson must be valid JSON.";
            return false;
        }

        if (request.DatasetId == Guid.Empty)
        {
            message = "DatasetId is required.";
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
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier);

        return Guid.TryParse(claimValue, out userId);
    }

    private bool TryGetUserRole(out UserRole userRole)
    {
        var roleClaim = User.FindFirstValue(ClaimTypes.Role) ?? User.FindFirstValue("role");
        return Enum.TryParse(roleClaim, true, out userRole);
    }
}
