using Microsoft.AspNetCore.Identity;

namespace FinanceManager.API.Models
{
    public class AppUser : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;
     
        public string RecoveryKeyword { get; set; } = string.Empty;


        // === AGREGA ESTO PARA EL RESET DE PASSWORD ===
        public string? PasswordResetToken { get; set; }
        public DateTime? ResetTokenExpires { get; set; }
    }
}   
