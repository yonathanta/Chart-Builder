using ChartBuilder.Api.Extensions;
using ChartBuilder.Api.Middleware;
using ChartBuilder.Api.Services;
using ChartBuilder.Application;
using FluentValidation;
using FluentValidation.AspNetCore;
using ChartBuilder.Domain.Entities;
using ChartBuilder.Infrastructure;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using System.Data;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

var configuredUrls = builder.Configuration["Urls"]
    ?? Environment.GetEnvironmentVariable("ASPNETCORE_URLS");

if (builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(configuredUrls))
{
    builder.WebHost.UseUrls("http://localhost:5000");
}

var resolvedDefaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(resolvedDefaultConnection))
{
    resolvedDefaultConnection = "Server=(localdb)\\MSSQLLocalDB;Database=ChartBuilderDb;Trusted_Connection=True;TrustServerCertificate=True;";
    builder.Configuration["ConnectionStrings:DefaultConnection"] = resolvedDefaultConnection;
}

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
        var configuredOrigins = builder.Configuration
            .GetSection("Cors:AllowedOrigins")
            .Get<string[]>() ?? ["http://localhost:5173"];

        var allowedOrigins = configuredOrigins
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        policy
            .WithOrigins(allowedOrigins)
            .SetIsOriginAllowed(origin =>
            {
                if (!Uri.TryCreate(origin, UriKind.Absolute, out var parsedOrigin))
                {
                    return false;
                }

                return parsedOrigin.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                    || parsedOrigin.Host.Equals("127.0.0.1", StringComparison.OrdinalIgnoreCase);
            })
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
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();

    options.AddPolicy("AdminOnly", policy =>
        policy.RequireRole(UserRole.Admin.ToString(), UserRole.SuperAdmin.ToString()));
});

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(resolvedDefaultConnection));
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(resolvedDefaultConnection));

builder.Services
    .AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddDefaultTokenProviders();

builder.Services.AddJwtAuthentication(builder.Configuration);
var httpsPort = builder.Configuration.GetValue<int?>("HttpsRedirection:HttpsPort");
var enableHttpsRedirection = builder.Configuration.GetValue<bool?>("HttpsRedirection:Enabled")
    ?? (!builder.Environment.IsDevelopment() && httpsPort.HasValue);
if (enableHttpsRedirection)
{
    builder.Services.AddHttpsRedirection(options =>
    {
        if (httpsPort.HasValue)
        {
            options.HttpsPort = httpsPort.Value;
        }
    });
}

builder.Services.AddScoped<IAuditLogService, AuditLogService>();
builder.Services.AddScoped<IOwnershipValidationService, OwnershipValidationService>();
builder.Services.AddScoped<IChartService, ChartService>();
builder.Services.AddScoped<IProjectService, ProjectService>();
builder.Services.AddScoped<IUserService, UserService>();
builder.Services.AddScoped<IReportService, ReportService>();

var app = builder.Build();
var enableSwagger = builder.Configuration.GetValue("Swagger:Enabled", true);

using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    try
    {
        var identityDbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        identityDbContext.Database.SetConnectionString(resolvedDefaultConnection);
        await identityDbContext.Database.MigrateAsync();

        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await RoleSeeder.SeedAsync(roleManager);

        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        dbContext.Database.SetConnectionString(resolvedDefaultConnection);

        var connection = dbContext.Database.GetDbConnection();
        if (string.IsNullOrWhiteSpace(connection.ConnectionString))
        {
            connection.ConnectionString = resolvedDefaultConnection;
        }

        var shouldRunMigrations = true;
        try
        {
            var migrationsHistoryExists = await TableExistsAsync(dbContext, "__EFMigrationsHistory");
            var usersTableExists = await TableExistsAsync(dbContext, "Users");

            if (!migrationsHistoryExists && usersTableExists)
            {
                shouldRunMigrations = false;
                logger.LogWarning("Skipping EF migrations because table 'Users' exists but '__EFMigrationsHistory' does not. Database appears pre-initialized outside EF migrations.");
            }
        }
        catch (Exception exception)
        {
            logger.LogDebug(exception, "Could not inspect database schema. Falling back to running EF migrations.");
        }

        if (shouldRunMigrations)
        {
            try
            {
                await dbContext.Database.MigrateAsync();
            }
            catch (SqlException exception) when (exception.Number == 2714
                && exception.Message.Contains("Users", StringComparison.OrdinalIgnoreCase))
            {
                logger.LogWarning("Skipping EF migrations because table 'Users' already exists in a database that appears pre-initialized outside EF migrations.");
            }
        }

        var adminEmail = builder.Configuration["SeedAdmin:Email"] ?? "admin@chartbuilder.local";
        var adminPassword = builder.Configuration["SeedAdmin:Password"] ?? "Admin@123";
        var adminFullName = builder.Configuration["SeedAdmin:FullName"] ?? "System Administrator";

        var adminExists = await dbContext.Users.AnyAsync(user => user.Email == adminEmail);
        if (!adminExists)
        {

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

        var testUserName = builder.Configuration["SeedTestUser:UserName"] ?? "Admin";
        var testUserPassword = builder.Configuration["SeedTestUser:Password"] ?? "Password@1";
        var testUserFullName = builder.Configuration["SeedTestUser:FullName"] ?? "Admin Test User";

        var testUserExists = await dbContext.Users.AnyAsync(user => user.Email == testUserName);
        if (!testUserExists)
        {
            var testUser = new User(
                email: testUserName,
                passwordHash: string.Empty,
                fullName: testUserFullName,
                role: UserRole.Admin,
                isActive: true);

            var passwordHasher = new PasswordHasher<User>();
            testUser.SetPasswordHash(passwordHasher.HashPassword(testUser, testUserPassword));

            await dbContext.Users.AddAsync(testUser);
            await dbContext.SaveChangesAsync();
        }
    }
    catch (Exception exception)
    {
        logger.LogWarning(exception, "Database initialization failed. Continuing startup without migrations/seeding.");
    }
}

if (enableSwagger)
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<GlobalExceptionHandlingMiddleware>();
app.UseSerilogRequestLogging();

if (enableHttpsRedirection)
{
    app.UseHttpsRedirection();
}

app.UseCors("VueFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

static async Task<bool> TableExistsAsync(AppDbContext dbContext, string tableName)
{
    var connection = dbContext.Database.GetDbConnection();
    if (connection.State != ConnectionState.Open)
    {
        await connection.OpenAsync();
    }

    await using var command = connection.CreateCommand();
    command.CommandText = @"
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_NAME = @tableName
        ) THEN 1 ELSE 0 END";

    var parameter = command.CreateParameter();
    parameter.ParameterName = "@tableName";
    parameter.Value = tableName;
    command.Parameters.Add(parameter);

    var result = await command.ExecuteScalarAsync();
    return result is int exists && exists == 1;
}
