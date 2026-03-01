using ChartBuilder.Api.Extensions;
using ChartBuilder.Api.Middleware;
using ChartBuilder.Application;
using FluentValidation;
using FluentValidation.AspNetCore;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers();
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<Program>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("VueFrontend", policy =>
    {
        var allowedOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:5173"];

        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var securityScheme = new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Description = "Enter JWT token as: Bearer {token}",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Reference = new OpenApiReference
        {
            Type = ReferenceType.SecurityScheme,
            Id = "Bearer"
        }
    };

    options.AddSecurityDefinition("Bearer", securityScheme);
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            securityScheme,
            Array.Empty<string>()
        }
    });
});
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole(UserRole.Admin.ToString()));
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddJwtAuthentication(builder.Configuration);

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await dbContext.Database.MigrateAsync();

        var adminExists = await dbContext.Users.AnyAsync(user => user.Role == UserRole.Admin);
        if (!adminExists)
        {
            var adminEmail = builder.Configuration["SeedAdmin:Email"] ?? "admin@chartbuilder.local";
            var adminPassword = builder.Configuration["SeedAdmin:Password"] ?? "Admin@123";
            var adminFullName = builder.Configuration["SeedAdmin:FullName"] ?? "System Administrator";

            var adminUser = new User(
                email: adminEmail,
                passwordHash: string.Empty,
                fullName: adminFullName,
                role: UserRole.Admin,
                isActive: true);

            var passwordHasher = new PasswordHasher<User>();
            adminUser.SetPasswordHash(passwordHasher.HashPassword(adminUser, adminPassword));

            await dbContext.Users.AddAsync(adminUser);
            await dbContext.SaveChangesAsync();
        }
    }
    catch (Exception exception)
    {
        logger.LogWarning(exception, "Database initialization failed. Continuing startup without migrations/seeding.");
    }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();

app.UseHttpsRedirection();
app.UseCors("VueFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
