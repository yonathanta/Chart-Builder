using ChartBuilder.Domain.Entities;
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
        });

        modelBuilder.Entity<Project>(entity =>
        {
            entity.HasKey(project => project.Id);

            entity.HasMany(project => project.Charts)
                .WithOne(chart => chart.Project)
                .HasForeignKey(chart => chart.ProjectId)
                .OnDelete(DeleteBehavior.Cascade)
                .IsRequired();
        });

        modelBuilder.Entity<Chart>(entity =>
        {
            entity.HasKey(chart => chart.Id);
        });

        base.OnModelCreating(modelBuilder);
    }
}
