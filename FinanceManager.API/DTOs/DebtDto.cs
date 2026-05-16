using System.ComponentModel.DataAnnotations;

namespace FinanceManager.API.DTOs
{
    public class DebtDto
    {
        public int Id { get; set; }
        public string Name { get; set; }

        // Original amount the user entered at creation. Stored as Debt.Balance in the DB.
        public decimal OriginalBalance { get; set; }

        // Computed live as sum of installment amounts. Reflects the true current schedule
        // after any per-installment edits.
        public decimal CurrentBalance { get; set; }

        public decimal InterestRate { get; set; }
        public int Installments { get; set; }
        public int PaidInstallments { get; set; }
        public string Color { get; set; }
        public string Icon { get; set; }

        public List<InstallmentDto> InstallmentsList { get; set; } = new List<InstallmentDto>();
    }

    public class CreateDebtDto
    {
        public string Name { get; set; }

        [Range(0.01, double.MaxValue, ErrorMessage = "Balance must be greater than zero.")]
        public decimal OriginalBalance { get; set; }

        public decimal InterestRate { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Installments must be at least 1.")]
        public int Installments { get; set; }

        public string Color { get; set; }
        public string Icon { get; set; }
    }

    public class UpdateDebtDto
    {
        public string Name { get; set; }

        [Range(0.01, double.MaxValue, ErrorMessage = "Balance must be greater than zero.")]
        public decimal OriginalBalance { get; set; }

        public decimal InterestRate { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Installments must be at least 1.")]
        public int Installments { get; set; }

        public string Color { get; set; }
        public string Icon { get; set; }
    }
}
