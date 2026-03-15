using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Chart : BaseEntity
{
    private readonly List<DashboardChart> _dashboardCharts = [];
    private readonly List<ReportChart> _reportCharts = [];

    public string Name { get; private set; } = string.Empty;
    public string ChartType { get; private set; } = string.Empty;
    public string ConfigJson { get; private set; } = string.Empty;
    public string StyleJson { get; private set; } = string.Empty;
    public Guid DatasetId { get; private set; }
    public ChartStatus Status { get; private set; } = ChartStatus.Draft;
    public Guid ProjectId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }
    public Dataset? Dataset { get; private set; }
    public IReadOnlyCollection<DashboardChart> DashboardCharts => _dashboardCharts;
    public IReadOnlyCollection<ReportChart> ReportCharts => _reportCharts;

    private Chart()
    {
    }

    public Chart(
        string name,
        string chartType,
        string configJson,
        string styleJson,
        Guid datasetId,
        Guid projectId)
    {
        Name = name;
        ChartType = chartType;
        ConfigJson = configJson;
        StyleJson = styleJson;
        DatasetId = datasetId;
        Status = ChartStatus.Draft;
        ProjectId = projectId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(
        string name,
        string chartType,
        string configJson,
        string styleJson,
        Guid datasetId)
    {
        Name = name;
        ChartType = chartType;
        ConfigJson = configJson;
        StyleJson = styleJson;
        DatasetId = datasetId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateStatus(ChartStatus status)
    {
        Status = status;
        UpdatedAt = DateTime.UtcNow;
    }
}
