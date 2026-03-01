namespace ChartBuilder.Application.Charts.Dtos;

public sealed class ChartDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string ChartType { get; init; } = string.Empty;
    public string Configuration { get; init; } = string.Empty;
    public string Dataset { get; init; } = string.Empty;
    public Guid ProjectId { get; init; }
    public DateTime CreatedAt { get; init; }
    public DateTime UpdatedAt { get; init; }
}
