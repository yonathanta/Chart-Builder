using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Report : BaseEntity
{
    public string Title { get; private set; } = string.Empty;
    public string MetadataJson { get; private set; } = "{}";
    public string LayoutJson { get; private set; } = "{}";
    public Guid ProjectId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }

    private Report()
    {
    }

    public Report(string title, string metadataJson, string layoutJson, Guid projectId)
    {
        Title = title;
        MetadataJson = metadataJson;
        LayoutJson = layoutJson;
        ProjectId = projectId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(string title, string metadataJson, string layoutJson)
    {
        Title = title;
        MetadataJson = metadataJson;
        LayoutJson = layoutJson;
        UpdatedAt = DateTime.UtcNow;
    }
}