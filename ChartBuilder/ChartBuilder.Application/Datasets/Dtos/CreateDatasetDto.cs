using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Datasets.Dtos;

public sealed class CreateDatasetDto
{
    [Required]
    [MinLength(2)]
    public string Name { get; init; } = string.Empty;

    public string? Description { get; init; }

    [Required]
    public Guid ProjectId { get; init; }

    [Required]
    public string DataJson { get; init; } = string.Empty;

    [Required]
    public string SourceType { get; init; } = string.Empty;
}