// Archivo: DTOs/AccountDtos.cs
using System.ComponentModel.DataAnnotations;

namespace FinanceManager.API.DTOs
{
    public class RegisterDto
    {
        [Required]
        public string? Username { get; set; }

        [Required]
        [EmailAddress]
        public string? Email { get; set; }

        [Required]
        public string? Password { get; set; }
    }

    public class LoginDto
    {
        [Required]
        public string? Username { get; set; }

        [Required]
        public string? Password { get; set; }
    }

    public class UserDto
    {
        public string? Username { get; set; }
        public string? Token { get; set; }
    }
}

