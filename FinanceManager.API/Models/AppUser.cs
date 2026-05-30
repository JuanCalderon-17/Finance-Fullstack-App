using Microsoft.AspNetCore.Identity;

namespace FinanceManager.API.Models
{
    public class AppUser : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;

        public string? ProfilePictureUrl { get; set; }

        public string RecoveryKeyword { get; set; } = string.Empty;

        //email verification
        public bool IsEmailVerified {get; set; } = false;
        public string? EmailVerificationToken {get; set; } 

        //for the password reset
        public string? PasswordResetToken { get; set; }
        public DateTime? ResetTokenExpires { get; set; }
    }
}   
