using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Auth.Dtos;

public sealed class ResetPasswordDto
{
    [Required]
    public string Token { get; init; } = string.Empty;

    [Required]
    [MinLength(8)]
    public string NewPassword { get; init; } = string.Empty;
}
