using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Report : BaseEntity
{
    private readonly List<ReportChart> _reportCharts = [];

    public string Name { get; private set; } = string.Empty;
    public string Title { get; private set; } = string.Empty;
    public string MetadataJson { get; private set; } = "{}";
    public string LayoutJson { get; private set; } = "{}";
    public Guid ProjectId { get; private set; }
    public string UserId { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }
    public IReadOnlyCollection<ReportChart> ReportCharts => _reportCharts;

    private Report()
    {
    }

    public Report(string title, string metadataJson, string layoutJson, Guid projectId)
    {
        Name = title;
        Title = title;
        MetadataJson = metadataJson;
        LayoutJson = layoutJson;
        ProjectId = projectId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(string title, string metadataJson, string layoutJson)
    {
        Name = title;
        Title = title;
        MetadataJson = metadataJson;
        LayoutJson = layoutJson;
        UpdatedAt = DateTime.UtcNow;
    }

    public Report(string name, Guid projectId, string userId)
    {
        Name = name;
        Title = name;
        ProjectId = projectId;
        UserId = userId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddChart(ReportChart reportChart)
    {
        _reportCharts.Add(reportChart);
        UpdatedAt = DateTime.UtcNow;
    }
}