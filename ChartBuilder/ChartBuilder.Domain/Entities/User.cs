using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class User : BaseEntity
{
    private readonly List<Project> _projects = [];
    private readonly List<ProjectMember> _projectMembers = [];
    private readonly List<AuditLog> _auditLogs = [];

    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string? PasswordResetTokenHash { get; private set; }
    public DateTime? PasswordResetTokenExpiresAtUtc { get; private set; }
    public string FullName { get; private set; } = string.Empty;
    public UserRole Role { get; private set; } = UserRole.Viewer;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public bool IsActive { get; private set; } = true;

    public IReadOnlyCollection<Project> Projects => _projects;
    public IReadOnlyCollection<ProjectMember> ProjectMembers => _projectMembers;
    public IReadOnlyCollection<AuditLog> AuditLogs => _auditLogs;

    private User()
    {
    }

    public User(
        string email,
        string passwordHash,
        string fullName,
        UserRole role = UserRole.Viewer,
        bool isActive = true)
    {
        Email = email;
        PasswordHash = passwordHash;
        FullName = fullName;
        Role = role;
        IsActive = isActive;
        CreatedAt = DateTime.UtcNow;
    }

    public User(
        Guid id,
        string email,
        string passwordHash,
        string fullName,
        UserRole role = UserRole.Viewer,
        bool isActive = true)
        : this(email, passwordHash, fullName, role, isActive)
    {
        Id = id;
    }

    public void AddProject(Project project)
    {
        _projects.Add(project);
    }

    public void AddProjectMember(ProjectMember projectMember)
    {
        _projectMembers.Add(projectMember);
    }

    public void AddAuditLog(AuditLog auditLog)
    {
        _auditLogs.Add(auditLog);
    }

    public void SetPasswordHash(string passwordHash)
    {
        PasswordHash = passwordHash;
    }

    public void SetPasswordResetToken(string tokenHash, DateTime expiresAtUtc)
    {
        PasswordResetTokenHash = tokenHash;
        PasswordResetTokenExpiresAtUtc = expiresAtUtc;
    }

    public void ClearPasswordResetToken()
    {
        PasswordResetTokenHash = null;
        PasswordResetTokenExpiresAtUtc = null;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void UpdateRole(UserRole role)
    {
        Role = role;
    }
}
