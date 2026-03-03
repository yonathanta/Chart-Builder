using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class AuditLog : BaseEntity
{
    public Guid UserId { get; private set; }
    public string ActionType { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public Guid EntityId { get; private set; }
    public DateTime Timestamp { get; private set; } = DateTime.UtcNow;
    public string? OldValue { get; private set; }
    public string? NewValue { get; private set; }

    public User? User { get; private set; }

    private AuditLog()
    {
    }

    public AuditLog(
        Guid userId,
        string actionType,
        string entityType,
        Guid entityId,
        string? oldValue,
        string? newValue)
    {
        UserId = userId;
        ActionType = actionType;
        EntityType = entityType;
        EntityId = entityId;
        OldValue = oldValue;
        NewValue = newValue;
        Timestamp = DateTime.UtcNow;
    }
}