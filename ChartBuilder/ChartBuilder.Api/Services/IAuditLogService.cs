namespace ChartBuilder.Api.Services;

public interface IAuditLogService
{
    void Add(
        Guid userId,
        string actionType,
        string entityType,
        Guid entityId,
        object? oldValue,
        object? newValue);
}