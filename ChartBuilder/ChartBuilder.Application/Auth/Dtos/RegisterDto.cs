using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Auth.Dtos;

public sealed class RegisterDto
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string Password { get; init; } = string.Empty;

    [Required]
    [MinLength(2)]
    public string FullName { get; init; } = string.Empty;
}
