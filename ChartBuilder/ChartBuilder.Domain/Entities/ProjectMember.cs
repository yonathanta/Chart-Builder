using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class ProjectMember : BaseEntity
{
    public Guid ProjectId { get; private set; }
    public Guid UserId { get; private set; }
    public ProjectMemberRole Role { get; private set; } = ProjectMemberRole.Viewer;
    public DateTime AssignedAt { get; private set; } = DateTime.UtcNow;

    public Project? Project { get; private set; }
    public User? User { get; private set; }

    private ProjectMember()
    {
    }

    public ProjectMember(Guid projectId, Guid userId, ProjectMemberRole role = ProjectMemberRole.Viewer)
    {
        ProjectId = projectId;
        UserId = userId;
        Role = role;
        AssignedAt = DateTime.UtcNow;
    }

    public void UpdateRole(ProjectMemberRole role)
    {
        Role = role;
    }
}