using ChartBuilder.Application.Projects.Dtos;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Services;

public sealed class ProjectService : IProjectService
{
    private readonly AppDbContext _dbContext;
    private readonly IAuditLogService _auditLogService;

    public ProjectService(AppDbContext dbContext, IAuditLogService auditLogService)
    {
        _dbContext = dbContext;
        _auditLogService = auditLogService;
    }

    public async Task<Project?> UpdateAsync(Guid userId, Guid projectId, UpdateProjectDto request, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .Include(candidate => candidate.ProjectMembers)
            .FirstOrDefaultAsync(candidate => candidate.Id == projectId, cancellationToken);

        if (project is null)
        {
            return null;
        }

        EnsureCanModifyProject(project, userId);

        project.UpdateDetails(request.Name.Trim(), request.Description?.Trim() ?? string.Empty);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return project;
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid projectId, CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .Include(candidate => candidate.ProjectMembers)
            .FirstOrDefaultAsync(candidate => candidate.Id == projectId, cancellationToken);

        if (project is null)
        {
            return false;
        }

        EnsureCanModifyProject(project, userId);

        _dbContext.Projects.Remove(project);
        await _dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<ProjectMember?> AssignProjectRoleAsync(
        Guid actorUserId,
        Guid projectId,
        Guid memberUserId,
        ProjectMemberRole role,
        CancellationToken cancellationToken)
    {
        var project = await _dbContext.Projects
            .Include(candidate => candidate.ProjectMembers)
            .FirstOrDefaultAsync(candidate => candidate.Id == projectId, cancellationToken);

        if (project is null)
        {
            return null;
        }

        EnsureCanModifyProject(project, actorUserId);

        var userExists = await _dbContext.Users
            .AnyAsync(user => user.Id == memberUserId, cancellationToken);

        if (!userExists)
        {
            return null;
        }

        var projectMember = project.ProjectMembers.FirstOrDefault(member => member.UserId == memberUserId);
        var oldRole = projectMember?.Role;

        if (projectMember is null)
        {
            projectMember = new ProjectMember(projectId, memberUserId, role);
            await _dbContext.ProjectMembers.AddAsync(projectMember, cancellationToken);
        }
        else
        {
            projectMember.UpdateRole(role);
        }

        _auditLogService.Add(
            userId: actorUserId,
            actionType: "Project Role Assignment",
            entityType: "ProjectMember",
            entityId: projectMember.Id,
            oldValue: oldRole is null ? null : new { role = oldRole.ToString() },
            newValue: new
            {
                projectId,
                userId = memberUserId,
                role = projectMember.Role.ToString()
            });

        await _dbContext.SaveChangesAsync(cancellationToken);
        return projectMember;
    }

    private static void EnsureCanModifyProject(Project project, Guid userId)
    {
        var membershipRole = ResolveProjectRole(project, userId);

        if (membershipRole is ProjectMemberRole.Owner or ProjectMemberRole.Editor)
        {
            return;
        }

        throw new UnauthorizedAccessException("You do not have permission to modify this project.");
    }

    private static ProjectMemberRole ResolveProjectRole(Project project, Guid userId)
    {
        if (project.UserId == userId)
        {
            return ProjectMemberRole.Owner;
        }

        var member = project.ProjectMembers.FirstOrDefault(candidate => candidate.UserId == userId);
        if (member is null)
        {
            throw new UnauthorizedAccessException("You are not a member of this project.");
        }

        return member.Role;
    }
}