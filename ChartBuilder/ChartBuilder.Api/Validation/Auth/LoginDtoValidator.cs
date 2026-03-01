using ChartBuilder.Application.Auth.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Auth;

public sealed class LoginDtoValidator : AbstractValidator<LoginDto>
{
    public LoginDtoValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(request => request.Password)
            .NotEmpty()
            .MinimumLength(6);
    }
}
