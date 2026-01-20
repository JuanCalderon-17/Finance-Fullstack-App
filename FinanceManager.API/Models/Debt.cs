using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace FinanceManager.API.Models
{
    public class Debt
    {
        public int Id { get; set; }
        public string UserId { get; set; }
        public string Name { get; set; }
        public decimal Balance { get; set; }
        public decimal InterestRate { get; set; }
        public int Installments { get; set; }
        public int PaidInstallments { get; set; } // Ya no se usa pero se mantiene
        public string Color { get; set; }
        public string Icon { get; set; }

        // NUEVA RELACIÓN
        public List<Installment> InstallmentsList { get; set; } = new List<Installment>();

        // Navegación
        public AppUser? User { get; set; }
    }
}