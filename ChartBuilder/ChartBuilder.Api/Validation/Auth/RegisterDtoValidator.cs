using ChartBuilder.Application.Auth.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Auth;

public sealed class RegisterDtoValidator : AbstractValidator<RegisterDto>
{
    public RegisterDtoValidator()
    {
        RuleFor(request => request.FirstName)
            .NotEmpty()
            .MinimumLength(2);

        RuleFor(request => request.LastName)
            .NotEmpty()
            .MinimumLength(2);

        RuleFor(request => request.Email)
            .NotEmpty()
            .EmailAddress();

        RuleFor(request => request.PhoneNumber)
            .NotEmpty();

        RuleFor(request => request.Department)
            .NotEmpty();

        RuleFor(request => request.JobTitle)
            .NotEmpty();

        RuleFor(request => request.Password)
            .NotEmpty()
            .MinimumLength(8);

        RuleFor(request => request.ConfirmPassword)
            .NotEmpty()
            .Equal(request => request.Password);
    }
}
