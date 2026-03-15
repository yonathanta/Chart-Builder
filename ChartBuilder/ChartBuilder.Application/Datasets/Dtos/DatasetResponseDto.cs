namespace ChartBuilder.Application.Datasets.Dtos;

public sealed class DatasetResponseDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Description { get; init; }
    public Guid ProjectId { get; init; }
    public string DataJson { get; init; } = string.Empty;
    public string SourceType { get; init; } = string.Empty;
    public DateTime CreatedAt { get; init; }
}