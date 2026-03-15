namespace ChartBuilder.Application.Charts.Dtos;

public sealed class ChartDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ChartType { get; init; } = string.Empty;
    public string ConfigJson { get; init; } = string.Empty;
    public string StyleJson { get; init; } = string.Empty;
    public Guid DatasetId { get; init; }
    public Guid ProjectId { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
