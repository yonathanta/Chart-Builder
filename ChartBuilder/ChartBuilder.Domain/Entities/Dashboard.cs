using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Dashboard : BaseEntity
{
    private readonly List<DashboardChart> _dashboardCharts = [];

    public string Name { get; private set; } = string.Empty;
    public Guid ProjectId { get; private set; }
    public string UserId { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }
    public IReadOnlyCollection<DashboardChart> DashboardCharts => _dashboardCharts;

    private Dashboard()
    {
    }

    public Dashboard(string name, Guid projectId, string userId)
    {
        Name = name;
        ProjectId = projectId;
        UserId = userId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateName(string name)
    {
        Name = name;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddChart(DashboardChart dashboardChart)
    {
        _dashboardCharts.Add(dashboardChart);
        UpdatedAt = DateTime.UtcNow;
    }
}
