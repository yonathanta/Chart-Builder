using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Auth.Dtos;

public sealed class RegisterDto
{
    [Required]
    [MinLength(2)]
    public string FirstName { get; init; } = string.Empty;

    [Required]
    [MinLength(2)]
    public string LastName { get; init; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;

    [Required]
    public string PhoneNumber { get; init; } = string.Empty;

    [Required]
    public string Department { get; init; } = string.Empty;

    [Required]
    public string JobTitle { get; init; } = string.Empty;

    [Required]
    [MinLength(6)]
    public string Password { get; init; } = string.Empty;

    [Required]
    [Compare(nameof(Password))]
    public string ConfirmPassword { get; init; } = string.Empty;
}
