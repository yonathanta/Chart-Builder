using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Project : BaseEntity
{
    private readonly List<Chart> _charts = [];

    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid UserId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public User? User { get; private set; }
    public IReadOnlyCollection<Chart> Charts => _charts;

    private Project()
    {
    }

    public Project(string name, string description, Guid userId)
    {
        Name = name;
        Description = description;
        UserId = userId;
        CreatedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void UpdateDetails(string name, string description)
    {
        Name = name;
        Description = description;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddChart(Chart chart)
    {
        _charts.Add(chart);
        UpdatedAt = DateTime.UtcNow;
    }
}
