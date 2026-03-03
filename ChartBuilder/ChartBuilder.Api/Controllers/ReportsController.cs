using System.Security.Claims;
using ChartBuilder.Api.Services;
using ChartBuilder.Application.Reports.Dtos;
using ChartBuilder.Domain.Entities;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class ReportsController : ControllerBase
{
    private readonly IReportService _reportService;

    public ReportsController(IReportService reportService)
    {
        _reportService = reportService;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<Report>>> Get([FromQuery] Guid projectId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var reports = await _reportService.GetByProjectAsync(userId, projectId, cancellationToken);
        return Ok(reports);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Report>> GetById(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var report = await _reportService.GetByIdAsync(userId, id, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        return Ok(report);
    }

    [HttpPost]
    public async Task<ActionResult<Report>> Post([FromBody] SaveReportDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (request.ProjectId == Guid.Empty)
        {
            return BadRequest(new { message = "ProjectId is required." });
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var report = await _reportService.CreateAsync(userId, request, cancellationToken);
        return CreatedAtAction(nameof(GetById), new { id = report.Id }, report);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<Report>> Put(Guid id, [FromBody] SaveReportDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return BadRequest(new { message = "Title is required." });
        }

        var report = await _reportService.UpdateAsync(userId, id, request, cancellationToken);
        if (report is null)
        {
            return NotFound();
        }

        return Ok(report);
    }

    private bool TryGetUserId(out Guid userId)
    {
        var claimValue = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue(ClaimTypes.Name)
            ?? User.FindFirstValue("sub");

        return Guid.TryParse(claimValue, out userId);
    }
}
