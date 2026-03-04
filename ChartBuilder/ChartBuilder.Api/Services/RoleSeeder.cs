using Microsoft.AspNetCore.Identity;

namespace ChartBuilder.Api.Services;

public static class RoleSeeder
{
    private static readonly string[] RequiredRoles =
    [
        "Admin",
        "Manager",
        "Editor",
        "Viewer",
        "Pending"
    ];

    public static async Task SeedAsync(RoleManager<IdentityRole> roleManager)
    {
        foreach (var roleName in RequiredRoles)
        {
            var roleExists = await roleManager.RoleExistsAsync(roleName);
            if (roleExists)
            {
                continue;
            }

            var createResult = await roleManager.CreateAsync(new IdentityRole(roleName));
            if (!createResult.Succeeded)
            {
                var details = string.Join(", ", createResult.Errors.Select(identityError => identityError.Description));
                throw new InvalidOperationException($"Failed to create role '{roleName}'. {details}");
            }
        }
    }
}