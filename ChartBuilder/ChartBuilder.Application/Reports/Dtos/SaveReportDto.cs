namespace ChartBuilder.Application.Reports.Dtos;

public sealed class SaveReportDto
{
    public string Title { get; init; } = string.Empty;
    public string MetadataJson { get; init; } = "{}";
    public string LayoutJson { get; init; } = "{}";
    public Guid ProjectId { get; init; }
}
