using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Charts.Dtos;

public sealed class CreateChartDto
{
    [Required]
    [MinLength(2)]
    public string Name { get; init; } = string.Empty;

    [Required]
    public string ChartType { get; init; } = string.Empty;

    [Required]
    public string ConfigJson { get; init; } = string.Empty;

    [Required]
    public string StyleJson { get; init; } = string.Empty;

    [Required]
    public Guid DatasetId { get; init; }

    [Required]
    public Guid ProjectId { get; init; }
}
