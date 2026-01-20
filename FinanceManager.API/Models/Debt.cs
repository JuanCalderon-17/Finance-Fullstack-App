using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace FinanceManager.API.Models
{
    public class Debt
    {
        public int Id { get; set; }
        public string AppUserId { get; set; } // ← CAMBIADO
        public string Name { get; set; }
        public decimal Balance { get; set; }
        public decimal InterestRate { get; set; }
        public int Installments { get; set; }
        public int PaidInstallments { get; set; }
        public string Color { get; set; }
        public string Icon { get; set; }

        public List<Installment> InstallmentsList { get; set; } = new List<Installment>();

        public AppUser? User { get; set; }
    }
}