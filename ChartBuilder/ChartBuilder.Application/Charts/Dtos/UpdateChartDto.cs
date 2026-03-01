using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Charts.Dtos;

public sealed class UpdateChartDto
{
    [Required]
    [MinLength(2)]
    public string Name { get; init; } = string.Empty;

    [Required]
    public string ChartType { get; init; } = string.Empty;

    [Required]
    public string Configuration { get; init; } = string.Empty;

    [Required]
    public string Dataset { get; init; } = string.Empty;
}
