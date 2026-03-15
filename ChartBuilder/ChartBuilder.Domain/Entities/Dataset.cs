using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class Dataset : BaseEntity
{
    private readonly List<Chart> _charts = [];

    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid ProjectId { get; private set; }
    public string UserId { get; private set; } = string.Empty;
    public string DataJson { get; private set; } = string.Empty;
    public string SourceType { get; private set; } = string.Empty;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }
    public IReadOnlyCollection<Chart> Charts => _charts;

    private Dataset()
    {
    }

    public Dataset(
        string name,
        string? description,
        Guid projectId,
        string userId,
        string dataJson,
        string sourceType)
    {
        Name = name;
        Description = description;
        ProjectId = projectId;
        UserId = userId;
        DataJson = dataJson;
        SourceType = sourceType;
        CreatedAt = DateTime.UtcNow;
    }

    public void Update(
        string name,
        string? description,
        string dataJson,
        string sourceType)
    {
        Name = name;
        Description = description;
        DataJson = dataJson;
        SourceType = sourceType;
    }
}
