using System.Globalization;
using System.IO;
using System.Security.Claims;
using System.Text.Json;
using CsvHelper;
using ChartBuilder.Application.Datasets.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using OfficeOpenXml;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/[controller]")]
public sealed class DatasetsController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public DatasetsController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [HttpPost]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,User")]
    public async Task<ActionResult<DatasetResponseDto>> Post([FromBody] CreateDatasetDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId) || !Guid.TryParse(userId, out var parsedUserId))
        {
            return Unauthorized();
        }

        if (!IsValidCreateRequest(request, out var errorMessage))
        {
            return BadRequest(new { message = errorMessage });
        }

        var ownsProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == request.ProjectId && project.UserId == parsedUserId, cancellationToken);

        if (!ownsProject)
        {
            var projectExists = await _dbContext.Projects.AnyAsync(project => project.Id == request.ProjectId, cancellationToken);
            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound(new { message = "Project not found." });
        }

        var dataset = new Dataset(
            request.Name.Trim(),
            request.Description?.Trim(),
            request.ProjectId,
            userId,
            request.DataJson,
            request.SourceType.Trim());

        await _dbContext.Datasets.AddAsync(dataset, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { datasetId = dataset.Id }, MapToResponse(dataset));
    }

    [HttpPost("upload")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,User")]
    [RequestFormLimits(MultipartBodyLengthLimit = 50_000_000)]
    [RequestSizeLimit(50_000_000)]
    public async Task<ActionResult<DatasetResponseDto>> Upload(
        [FromForm] Guid projectId,
        [FromForm] string name,
        [FromForm] string? description,
        [FromForm] IFormFile file,
        [FromForm] string? sourceType,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId) || !Guid.TryParse(userId, out var parsedUserId))
        {
            return Unauthorized();
        }

        if (projectId == Guid.Empty)
        {
            return BadRequest(new { message = "ProjectId is required." });
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            return BadRequest(new { message = "Name is required." });
        }

        if (file is null || file.Length == 0)
        {
            return BadRequest(new { message = "A CSV or Excel file is required." });
        }

        var ownsProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == projectId && project.UserId == parsedUserId, cancellationToken);

        if (!ownsProject)
        {
            var projectExists = await _dbContext.Projects.AnyAsync(project => project.Id == projectId, cancellationToken);
            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound(new { message = "Project not found." });
        }

        string dataJson;
        string normalizedSourceType;

        try
        {
            (dataJson, normalizedSourceType) = await ConvertUploadToJsonAsync(file, sourceType, cancellationToken);
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }

        var dataset = new Dataset(
            name.Trim(),
            description?.Trim(),
            projectId,
            userId,
            dataJson,
            normalizedSourceType);

        await _dbContext.Datasets.AddAsync(dataset, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(GetById), new { datasetId = dataset.Id }, MapToResponse(dataset));
    }

    [HttpGet("project/{projectId:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
    public async Task<ActionResult<IReadOnlyList<DatasetResponseDto>>> GetByProject(Guid projectId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId) || !Guid.TryParse(userId, out var parsedUserId))
        {
            return Unauthorized();
        }

        var ownsProject = await _dbContext.Projects
            .AnyAsync(project => project.Id == projectId && project.UserId == parsedUserId, cancellationToken);

        if (!ownsProject)
        {
            var projectExists = await _dbContext.Projects.AnyAsync(project => project.Id == projectId, cancellationToken);
            if (projectExists)
            {
                return Unauthorized();
            }

            return NotFound(new { message = "Project not found." });
        }

        var datasets = await _dbContext.Datasets
            .AsNoTracking()
            .Where(dataset => dataset.ProjectId == projectId && dataset.UserId == userId)
            .OrderByDescending(dataset => dataset.CreatedAt)
            .ToListAsync(cancellationToken);

        return Ok(datasets.Select(MapToResponse).ToList());
    }

    [HttpGet("{datasetId:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,Reviewer,Viewer,User")]
    public async Task<ActionResult<DatasetResponseDto>> GetById(Guid datasetId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var dataset = await _dbContext.Datasets
            .AsNoTracking()
            .FirstOrDefaultAsync(candidate => candidate.Id == datasetId && candidate.UserId == userId, cancellationToken);

        if (dataset is null)
        {
            var exists = await _dbContext.Datasets.AnyAsync(candidate => candidate.Id == datasetId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        return Ok(MapToResponse(dataset));
    }

    [HttpPut("{datasetId:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,User")]
    public async Task<ActionResult<DatasetResponseDto>> Put(Guid datasetId, [FromBody] UpdateDatasetDto request, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        if (!IsValidUpdateRequest(request, out var errorMessage))
        {
            return BadRequest(new { message = errorMessage });
        }

        var dataset = await _dbContext.Datasets
            .FirstOrDefaultAsync(candidate => candidate.Id == datasetId && candidate.UserId == userId, cancellationToken);

        if (dataset is null)
        {
            var exists = await _dbContext.Datasets.AnyAsync(candidate => candidate.Id == datasetId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        dataset.Update(
            request.Name.Trim(),
            request.Description?.Trim(),
            request.DataJson,
            request.SourceType.Trim());

        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(dataset));
    }

    [HttpDelete("{datasetId:guid}")]
    [Authorize(Roles = "SuperAdmin,Admin,Statistician,User")]
    public async Task<IActionResult> Delete(Guid datasetId, CancellationToken cancellationToken)
    {
        if (!TryGetUserId(out var userId))
        {
            return Unauthorized();
        }

        var dataset = await _dbContext.Datasets
            .FirstOrDefaultAsync(candidate => candidate.Id == datasetId && candidate.UserId == userId, cancellationToken);

        if (dataset is null)
        {
            var exists = await _dbContext.Datasets.AnyAsync(candidate => candidate.Id == datasetId, cancellationToken);
            if (exists)
            {
                return Unauthorized();
            }

            return NotFound();
        }

        _dbContext.Datasets.Remove(dataset);
        await _dbContext.SaveChangesAsync(cancellationToken);

        return Ok();
    }

    private static DatasetResponseDto MapToResponse(Dataset dataset)
    {
        return new DatasetResponseDto
        {
            Id = dataset.Id,
            Name = dataset.Name,
            Description = dataset.Description,
            ProjectId = dataset.ProjectId,
            DataJson = dataset.DataJson,
            SourceType = dataset.SourceType,
            CreatedAt = dataset.CreatedAt
        };
    }

    private static bool IsValidCreateRequest(CreateDatasetDto request, out string message)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            message = "Name is required.";
            return false;
        }

        if (request.ProjectId == Guid.Empty)
        {
            message = "ProjectId is required.";
            return false;
        }

        if (!IsValidJson(request.DataJson))
        {
            message = "DataJson must be valid JSON.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.SourceType))
        {
            message = "SourceType is required.";
            return false;
        }

        message = string.Empty;
        return true;
    }

    private static bool IsValidUpdateRequest(UpdateDatasetDto request, out string message)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            message = "Name is required.";
            return false;
        }

        if (!IsValidJson(request.DataJson))
        {
            message = "DataJson must be valid JSON.";
            return false;
        }

        if (string.IsNullOrWhiteSpace(request.SourceType))
        {
            message = "SourceType is required.";
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

    private bool TryGetUserId(out string userId)
    {
        userId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty;
        return !string.IsNullOrWhiteSpace(userId);
    }

    private static async Task<(string DataJson, string SourceType)> ConvertUploadToJsonAsync(
        IFormFile file,
        string? sourceType,
        CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();

        await using var stream = file.OpenReadStream();

        return extension switch
        {
            ".csv" => (await ConvertCsvToJsonAsync(stream, cancellationToken), string.IsNullOrWhiteSpace(sourceType) ? "csv" : sourceType.Trim()),
            ".xlsx" or ".xlsm" => (ConvertExcelToJson(stream), string.IsNullOrWhiteSpace(sourceType) ? "excel" : sourceType.Trim()),
            _ => throw new InvalidOperationException("Unsupported file format. Only .csv, .xlsx, and .xlsm are supported.")
        };
    }

    private static async Task<string> ConvertCsvToJsonAsync(Stream stream, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(stream);
        using var csv = new CsvReader(reader, CultureInfo.InvariantCulture);

        if (!await csv.ReadAsync())
        {
            return "[]";
        }

        csv.ReadHeader();
        var headers = csv.HeaderRecord;

        if (headers is null || headers.Length == 0)
        {
            throw new InvalidOperationException("CSV must include a header row.");
        }

        var rows = new List<Dictionary<string, string?>>();

        while (await csv.ReadAsync())
        {
            cancellationToken.ThrowIfCancellationRequested();

            var row = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

            for (var columnIndex = 0; columnIndex < headers.Length; columnIndex++)
            {
                var header = string.IsNullOrWhiteSpace(headers[columnIndex])
                    ? $"Column{columnIndex + 1}"
                    : headers[columnIndex];

                row[header] = csv.GetField(columnIndex);
            }

            rows.Add(row);
        }

        return JsonSerializer.Serialize(rows);
    }

    private static string ConvertExcelToJson(Stream stream)
    {
        ExcelPackage.LicenseContext = LicenseContext.NonCommercial;

        using var package = new ExcelPackage(stream);
        var worksheet = package.Workbook.Worksheets.FirstOrDefault();

        if (worksheet?.Dimension is null)
        {
            return "[]";
        }

        var startRow = worksheet.Dimension.Start.Row;
        var endRow = worksheet.Dimension.End.Row;
        var startColumn = worksheet.Dimension.Start.Column;
        var endColumn = worksheet.Dimension.End.Column;

        var headers = new List<string>();
        for (var column = startColumn; column <= endColumn; column++)
        {
            var headerText = worksheet.Cells[startRow, column].Text;
            headers.Add(string.IsNullOrWhiteSpace(headerText) ? $"Column{column}" : headerText.Trim());
        }

        var rows = new List<Dictionary<string, string?>>();

        for (var rowIndex = startRow + 1; rowIndex <= endRow; rowIndex++)
        {
            var row = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);

            for (var columnIndex = startColumn; columnIndex <= endColumn; columnIndex++)
            {
                var header = headers[columnIndex - startColumn];
                row[header] = worksheet.Cells[rowIndex, columnIndex].Text;
            }

            rows.Add(row);
        }

        return JsonSerializer.Serialize(rows);
    }
}