using ChartBuilder.Domain.Common;

namespace ChartBuilder.Domain.Entities;

public sealed class AppUser : BaseEntity
{
    public string Email { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public string Role { get; private set; } = "User";

    private AppUser()
    {
    }

    public AppUser(string email, string passwordHash, string role = "User")
    {
        Email = email;
        PasswordHash = passwordHash;
        Role = role;
    }
}
