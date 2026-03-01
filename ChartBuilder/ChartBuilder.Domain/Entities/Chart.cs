using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Chart : BaseEntity
{
    public string Name { get; private set; } = string.Empty;
    public string ChartType { get; private set; } = string.Empty;
    public string Configuration { get; private set; } = string.Empty;
    public string Dataset { get; private set; } = string.Empty;
    public Guid ProjectId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }

    private Chart()
    {
    }

    public Chart(
        string name,
        string chartType,
        string configuration,
        string dataset,
        Guid projectId)
    {
        Name = name;
        ChartType = chartType;
        Configuration = configuration;
        Dataset = dataset;
        ProjectId = projectId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(
        string name,
        string chartType,
        string configuration,
        string dataset)
    {
        Name = name;
        ChartType = chartType;
        Configuration = configuration;
        Dataset = dataset;
        UpdatedAt = DateTime.UtcNow;
    }
}
