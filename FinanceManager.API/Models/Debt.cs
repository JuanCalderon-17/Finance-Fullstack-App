using System.ComponentModel.DataAnnotations;    
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;   

namespace FinanceManager.API.Models
{
    public class Debt
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,2)")]
        public decimal Balance { get; set; } //cuanto debo

        public string Color { get; set; } = string.Empty;
        public string Icon { get; set; } = "bi-credit-card";

        public string? AppUserId { get; set; }// esto permite que venga vacío desde el Frontend

    }
}
