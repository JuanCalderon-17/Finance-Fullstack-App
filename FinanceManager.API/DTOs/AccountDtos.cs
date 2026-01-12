using System.ComponentModel.DataAnnotations;

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
    }

    // Asegúrate de tener este DTO también para el ForgotPassword
    public class ForgotPasswordDto
    {
        public string Email { get; set; } = string.Empty;
    }
}