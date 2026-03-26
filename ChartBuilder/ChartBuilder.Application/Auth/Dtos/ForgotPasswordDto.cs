using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Auth.Dtos;

public sealed class ForgotPasswordDto
{
    [Required]
    [EmailAddress]
    public string Email { get; init; } = string.Empty;
}
