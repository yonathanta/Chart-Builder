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
    public DbSet<Dataset> Datasets { get; private set; } = null!;
    public DbSet<Dashboard> Dashboards { get; private set; } = null!;
    public DbSet<DashboardChart> DashboardCharts { get; private set; } = null!;
    public DbSet<ProjectMember> ProjectMembers { get; private set; } = null!;
    public DbSet<AuditLog> AuditLogs { get; private set; } = null!;
    public DbSet<Report> Reports { get; private set; } = null!;
    public DbSet<ReportChart> ReportCharts { get; private set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.ToTable("AspNetUsers", table => table.ExcludeFromMigrations());
            entity.HasKey(user => user.Id);
        });

        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(user => user.Id);
            entity.HasIndex(user => user.Email).IsUnique();
            entity.Property(user => user.PasswordResetTokenHash)
                .HasMaxLength(128)
                .IsRequired(false);
            entity.Property(user => user.PasswordResetTokenExpiresAtUtc)
                .IsRequired(false);

            entity.HasMany(user => user.Projects)
                .WithOne(project => project.User)
                .HasForeignKey(project => project.UserId)
                .IsRequired();

            entity.HasMany(user => user.ProjectMembers)
                .WithOne(projectMember => projectMember.User)
                .HasForeignKey(projectMember => projectMember.UserId)
                .OnDelete(DeleteBehavior.NoAction)
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

            entity.HasMany(project => project.Datasets)
                .WithOne(dataset => dataset.Project)
                .HasForeignKey(dataset => dataset.ProjectId)
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

            entity.HasMany(project => project.Dashboards)
                .WithOne(dashboard => dashboard.Project)
                .HasForeignKey(dashboard => dashboard.ProjectId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

            modelBuilder.Entity<Dataset>(entity =>
            {
                entity.HasKey(dataset => dataset.Id);
                entity.Property(dataset => dataset.Name).HasMaxLength(200).IsRequired();
                entity.Property(dataset => dataset.Description).HasMaxLength(2000).IsRequired(false);
                entity.Property(dataset => dataset.UserId).HasMaxLength(450).IsRequired();
                entity.Property(dataset => dataset.DataJson).HasColumnType("nvarchar(max)").IsRequired();
                entity.Property(dataset => dataset.SourceType).HasMaxLength(50).IsRequired();
                entity.Property(dataset => dataset.CreatedAt).IsRequired();
                entity.HasIndex(dataset => dataset.ProjectId);
                entity.HasIndex(dataset => dataset.UserId);
            });

        modelBuilder.Entity<Chart>(entity =>
        {
            entity.HasKey(chart => chart.Id);
            entity.Property(chart => chart.Name).HasMaxLength(200).IsRequired();
            entity.Property(chart => chart.ChartType).HasMaxLength(80).IsRequired();
            entity.Property(chart => chart.ConfigJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(chart => chart.StyleJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.HasIndex(chart => chart.ProjectId);
            entity.HasIndex(chart => chart.DatasetId);

            entity.HasOne(chart => chart.Dataset)
                .WithMany(dataset => dataset.Charts)
                .HasForeignKey(chart => chart.DatasetId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired();

            entity.HasMany(chart => chart.DashboardCharts)
                .WithOne(dashboardChart => dashboardChart.Chart)
                .HasForeignKey(dashboardChart => dashboardChart.ChartId)
                .OnDelete(DeleteBehavior.NoAction)
                .IsRequired();

            entity.HasMany(chart => chart.ReportCharts)
                .WithOne(reportChart => reportChart.Chart)
                .HasForeignKey(reportChart => reportChart.ChartId)
                .OnDelete(DeleteBehavior.NoAction)
                .IsRequired();
        });

        modelBuilder.Entity<Dashboard>(entity =>
        {
            entity.HasKey(dashboard => dashboard.Id);
            entity.Property(dashboard => dashboard.Name).HasMaxLength(200).IsRequired();
            entity.Property(dashboard => dashboard.UserId).HasMaxLength(450).IsRequired();
            entity.Property(dashboard => dashboard.LayoutJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(dashboard => dashboard.ComponentsJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(dashboard => dashboard.PageStructureJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(dashboard => dashboard.SnapshotJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.HasIndex(dashboard => dashboard.ProjectId);
            entity.HasIndex(dashboard => dashboard.UpdatedAt);

            entity.HasMany(dashboard => dashboard.DashboardCharts)
                .WithOne(dashboardChart => dashboardChart.Dashboard)
                .HasForeignKey(dashboardChart => dashboardChart.DashboardId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity<DashboardChart>(entity =>
        {
            entity.HasKey(dashboardChart => dashboardChart.Id);
            entity.HasIndex(dashboardChart => dashboardChart.DashboardId);
            entity.HasIndex(dashboardChart => dashboardChart.ChartId);
            entity.HasIndex(dashboardChart => new { dashboardChart.DashboardId, dashboardChart.ChartId }).IsUnique();
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
            entity.Property(report => report.Name).HasMaxLength(200).IsRequired();
            entity.Property(report => report.Title).HasMaxLength(200).IsRequired();
            entity.Property(report => report.UserId).HasMaxLength(450).IsRequired(false);
            entity.Property(report => report.MetadataJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.Property(report => report.LayoutJson).HasColumnType("nvarchar(max)").IsRequired();
            entity.HasIndex(report => report.ProjectId);
            entity.HasIndex(report => report.UpdatedAt);

            entity.HasMany(report => report.ReportCharts)
                .WithOne(reportChart => reportChart.Report)
                .HasForeignKey(reportChart => reportChart.ReportId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity<ReportChart>(entity =>
        {
            entity.HasKey(reportChart => reportChart.Id);
            entity.HasIndex(reportChart => reportChart.ReportId);
            entity.HasIndex(reportChart => reportChart.ChartId);
            entity.HasIndex(reportChart => new { reportChart.ReportId, reportChart.ChartId }).IsUnique();
            entity.HasIndex(reportChart => new { reportChart.ReportId, reportChart.OrderIndex }).IsUnique();
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
