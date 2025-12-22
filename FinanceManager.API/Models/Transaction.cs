using Microsoft.AspNetCore.Identity;    
using System.ComponentModel.DataAnnotations.Schema;
using System.ComponentModel.DataAnnotations;    


namespace FinanceManager.API.Models
{
    public class Transaction
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public DateTime TransactionDate { get; set; }
        public string Category { get; set; } = string.Empty;

        // Relación con el usuario
        [Required]
        public string AppUserId { get; set; } = string.Empty;

        [ForeignKey("AppUserId")]
        public AppUser? AppUser { get; set; }  
    }
}
