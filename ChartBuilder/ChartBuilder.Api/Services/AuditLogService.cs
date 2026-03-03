using System.Text.Json;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;

namespace ChartBuilder.Api.Services;

public sealed class AuditLogService : IAuditLogService
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);
    private readonly AppDbContext _dbContext;

    public AuditLogService(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    public void Add(
        Guid userId,
        string actionType,
        string entityType,
        Guid entityId,
        object? oldValue,
        object? newValue)
    {
        var auditLog = new AuditLog(
            userId: userId,
            actionType: actionType,
            entityType: entityType,
            entityId: entityId,
            oldValue: Serialize(oldValue),
            newValue: Serialize(newValue));

        _dbContext.AuditLogs.Add(auditLog);
    }

    private static string? Serialize(object? value)
    {
        if (value is null)
        {
            return null;
        }

        return JsonSerializer.Serialize(value, SerializerOptions);
    }
}