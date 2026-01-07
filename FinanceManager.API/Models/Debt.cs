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
        public decimal Balance { get; set; } // Monto Total Original

        public double InterestRate { get; set; } // % Interés Anual
        public int Installments { get; set; }    // Número de Cuotas (Plazo)
        public int PaidInstallments { get; set; } // Cuotas ya pagadas

        public string Color { get; set; } = string.Empty;
        public string Icon { get; set; } = "bi-credit-card";

        public string? AppUserId { get; set; }

        [JsonIgnore]
        public AppUser? AppUser { get; set; }
    }
}