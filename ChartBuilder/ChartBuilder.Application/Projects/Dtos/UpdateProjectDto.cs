using System.ComponentModel.DataAnnotations;

namespace ChartBuilder.Application.Projects.Dtos;

public sealed class UpdateProjectDto
{
    [Required]
    [MinLength(2)]
    public string Name { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;
}
