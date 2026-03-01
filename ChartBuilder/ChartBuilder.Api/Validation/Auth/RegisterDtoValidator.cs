using ChartBuilder.Application.Auth.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Auth;

public sealed class RegisterDtoValidator : AbstractValidator<RegisterDto>
{
    public RegisterDtoValidator()
    {
        RuleFor(request => request.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(request => request.Password)
            .NotEmpty()
            .MinimumLength(8);

        RuleFor(request => request.FullName)
            .NotEmpty()
            .MinimumLength(2);
    }
}
