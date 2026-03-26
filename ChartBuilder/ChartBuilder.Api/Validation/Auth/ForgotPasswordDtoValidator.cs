using ChartBuilder.Application.Auth.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Auth;

public sealed class ForgotPasswordDtoValidator : AbstractValidator<ForgotPasswordDto>
{
    public ForgotPasswordDtoValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty()
            .EmailAddress();
    }
}
