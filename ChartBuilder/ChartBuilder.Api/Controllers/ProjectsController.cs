using System.Security.Claims;
using ChartBuilder.Api.Services;
using ChartBuilder.Application.Projects.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ProjectsController : ControllerBase
{
    private readonly AppDbContext _dbContext;
    private readonly IOwnershipValidationService _ownershipValidationService;
    private readonly IProjectService _projectService;

    public ProjectsController(
        AppDbContext dbContext,
        IOwnershipValidationService ownershipValidationService,
        IProjectService projectService)
    {
        _dbContext = dbContext;
        _ownershipValidationService = ownershipValidationService;
        _projectService = projectService;
    }

    [HttpGet]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer")]
    public async Task<ActionResult<IReadOnlyList<Project>>> Get(CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var projects = await _ownershipValidationService.GetOwnedProjectsAsync(userId, cancellationToken);

        return Ok(projects);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer")]
    public async Task<ActionResult<Project>> GetById(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var project = await _ownershipValidationService.GetOwnedProjectAsync(userId, id, cancellationToken);

        if (project is null)
        {
            return NotFound();
        }

        return Ok(project);
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician")]
    public async Task<ActionResult<Project>> Post([FromBody] CreateProjectDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var project = new Project(request.Name.Trim(), request.Description?.Trim() ?? string.Empty, userId);

        await _dbContext.Projects.AddAsync(project, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { id = project.Id }, project);
    }

    [HttpPut("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer")]
    public async Task<ActionResult<Project>> Put(Guid id, [FromBody] UpdateProjectDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        var project = await _projectService.UpdateAsync(userId, id, request, cancellationToken);
        if (project is null)
        {
            return NotFound();
        }

        return Ok(project);
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var deleted = await _projectService.DeleteAsync(userId, id, cancellationToken);
        if (!deleted)
        {
            return NotFound();
        }

        return Ok();
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("sub");

        return Guid.TryParse(claimValue, out userId);
    }
}
