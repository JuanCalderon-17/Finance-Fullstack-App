using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceManager.API.Models
{
    public class SavingsAccount
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? Goal { get; set; }

        public string Color { get; set; } = string.Empty;

        public string Icon { get; set; } = "bi-bank";

        public string AppUserId { get; set; }
        public AppUser? AppUser { get; set; }
    }
}