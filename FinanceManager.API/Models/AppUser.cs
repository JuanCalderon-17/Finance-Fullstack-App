using Microsoft.AspNetCore.Identity;

namespace FinanceManager.API.Models
{
    public class AppUser : IdentityUser
    {
        public string FullName { get; set; } = string.Empty;
        //public ICollection<Transaction> Transaction { get; set; } 


        public string RecoveryKeyword { get; set; } = string.Empty;
    }
}   
