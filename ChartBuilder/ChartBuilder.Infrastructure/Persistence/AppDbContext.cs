using ChartBuilder.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<User> Users { get; private set; } = null!;
    public DbSet<Project> Projects { get; private set; } = null!;
    public DbSet<Chart> Charts { get; private set; } = null!;
    public DbSet<ProjectMember> ProjectMembers { get; private set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; private set; } = null!;
    public DbSet<Report> Reports { get; private set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(user => user.Id);
            entity.HasIndex(user => user.Email).IsUnique();

            entity.HasMany(user => user.Projects)
                .WithOne(project => project.User)
                .HasForeignKey(project => project.UserId)
                .IsRequired();

            entity.HasMany(user => user.ProjectMembers)
                .WithOne(projectMember => projectMember.User)
                .HasForeignKey(projectMember => projectMember.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            entity.HasMany(user => user.AuditLogs)
                .WithOne(auditLog => auditLog.User)
                .HasForeignKey(auditLog => auditLog.UserId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(project => project.Id);

            entity.HasMany(project => project.Charts)
                .WithOne(chart => chart.Project)
                .HasForeignKey(chart => chart.ProjectId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            entity.HasMany(project => project.ProjectMembers)
                .WithOne(projectMember => projectMember.Project)
                .HasForeignKey(projectMember => projectMember.ProjectId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();

            entity.HasMany(project => project.Reports)
                .WithOne(report => report.Project)
                .HasForeignKey(report => report.ProjectId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity<Chart>(entity =>
        {
            entity.HasKey(chart => chart.Id);
        });

        modelBuilder.Entity<ProjectMember>(entity =>
        {
            entity.HasKey(projectMember => projectMember.Id);
            entity.HasIndex(projectMember => new { projectMember.ProjectId, projectMember.UserId }).IsUnique();
        });

        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.HasKey(auditLog => auditLog.Id);
            entity.Property(auditLog => auditLog.ActionType).HasMaxLength(100).IsRequired();
            entity.Property(auditLog => auditLog.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(auditLog => auditLog.OldValue).HasColumnType("nvarchar(max)");
            entity.Property(auditLog => auditLog.NewValue).HasColumnType("nvarchar(max)");
            entity.HasIndex(auditLog => auditLog.Timestamp);
            entity.HasIndex(auditLog => auditLog.UserId);
            entity.HasIndex(auditLog => new { auditLog.EntityType, auditLog.EntityId });
        });

        modelBuilder.Entity<Report>(entity =>
        {
            entity.HasKey(report => report.Id);
            entity.Property(report => report.Title).HasMaxLength(200).IsRequired();
            entity.Property(report => report.MetadataJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(report => report.LayoutJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.HasIndex(report => report.ProjectId);
            entity.HasIndex(report => report.UpdatedAt);
        });

        base.OnModelCreating(modelBuilder);
    }
}

public sealed class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole, string>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options)
    {
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<ApplicationUser>(entity =>
        {
            entity.Property(user => user.IsApproved)
                .HasDefaultValue(false);

            entity.Property(user => user.CreatedAt)
                .HasDefaultValueSql("GETUTCDATE()");
        });
    }
}
