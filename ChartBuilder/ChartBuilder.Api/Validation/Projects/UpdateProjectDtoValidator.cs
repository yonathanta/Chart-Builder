using ChartBuilder.Application.Projects.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Projects;

public sealed class UpdateProjectDtoValidator : AbstractValidator<UpdateProjectDto>
{
    public UpdateProjectDtoValidator()
    {
        RuleFor(request => request.Name)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(120);

        RuleFor(request => request.Description)
            .MaximumLength(2000);
    }
}
