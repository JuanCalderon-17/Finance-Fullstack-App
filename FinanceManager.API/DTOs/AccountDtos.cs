using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.SignalR;
using Microsoft.Net.Http.Headers;

namespace FinanceManager.API.DTOs
{
    public class RegisterDto
    {
        // ELIMINAMOS Username porque Angular no lo envía

        [Required]
        public string FullName { get; set; } = string.Empty; // Agregamos este que SÍ envía

        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;

        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class LoginDto
    {
        [Required]
        public string Username { get; set; } = string.Empty; // Aquí va el email
        [Required]
        public string Password { get; set; } = string.Empty;
    }

    public class UserDto
    {
        public string Username { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string? ProfilePictureUrl { get; set; }
    }

    public class UpdateProfileDto
    {
        public string FullName { get; set; } = string.Empty;
        public string? ProfilePictureUrl { get; set; }
    }

    public class ChangePasswordDto
    {
        [Required]
        public string CurrentPassword { get; set; } = string.Empty;

        [Required]
        public string NewPassword { get; set; } = string.Empty;
    }

    public class SavingsDto
    {
        [Required]
        [StringLength(100, MinimumLength = 1)]
        public string Name { get; set; } = string.Empty;

        [Range(0, 999999999)]
        public decimal Balance { get; set; }

        [Range(0, 999999999)]
        public decimal? Goal { get; set; }

        [StringLength(20)]
        public string Color { get; set; } = string.Empty;

        [StringLength(40)]
        public string Icon { get; set; } = "bi-bank";
    }

    public class ForgotPasswordDto
    {
        public string Email { get; set; } = string.Empty;
    }

    public class ResendVerificationDto
    {
        [Required]
        [EmailAddress]
        public string Email { get; set; } = string.Empty;
    }

    public class DeleteAccountDto
    {
        [Required]
        public string Password { get; set; } 

    }
}