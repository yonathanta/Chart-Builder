using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Project : BaseEntity
{
    private readonly List<Chart> _charts = [];
    private readonly List<ProjectMember> _projectMembers = [];
    private readonly List<Report> _reports = [];

    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public Guid UserId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; private set; } = DateTime.UtcNow;

    public User? User { get; private set; }
    public IReadOnlyCollection<Chart> Charts => _charts;
    public IReadOnlyCollection<ProjectMember> ProjectMembers => _projectMembers;
    public IReadOnlyCollection<Report> Reports => _reports;

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

    public void AddProjectMember(ProjectMember projectMember)
    {
        _projectMembers.Add(projectMember);
        UpdatedAt = DateTime.UtcNow;
    }

    public void AddReport(Report report)
    {
        _reports.Add(report);
        UpdatedAt = DateTime.UtcNow;
    }
}
