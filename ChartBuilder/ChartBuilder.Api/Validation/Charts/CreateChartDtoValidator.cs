using ChartBuilder.Application.Charts.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Charts;

public sealed class CreateChartDtoValidator : AbstractValidator<CreateChartDto>
{
    public CreateChartDtoValidator()
    {
        RuleFor(request => request.Name)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(120);

        RuleFor(request => request.ChartType)
            .NotEmpty()
            .MaximumLength(80);

        RuleFor(request => request.Configuration)
            .NotEmpty();

        RuleFor(request => request.Dataset)
            .NotEmpty();

        RuleFor(request => request.ProjectId)
            .NotEmpty();
    }
}
