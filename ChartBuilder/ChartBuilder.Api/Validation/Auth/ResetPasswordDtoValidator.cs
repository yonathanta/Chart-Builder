using ChartBuilder.Application.Auth.Dtos;
using FluentValidation;

namespace ChartBuilder.Api.Validation.Auth;

public sealed class ResetPasswordDtoValidator : AbstractValidator<ResetPasswordDto>
{
    public ResetPasswordDtoValidator()
    {
        RuleFor(request => request.Token)
            .NotEmpty();

        RuleFor(request => request.NewPassword)
            .NotEmpty()
            .MinimumLength(8)
            .Matches("[A-Z]").WithMessage("Password must contain at least one uppercase letter.")
            .Matches("[a-z]").WithMessage("Password must contain at least one lowercase letter.")
            .Matches("[0-9]").WithMessage("Password must contain at least one number.");
    }
}
