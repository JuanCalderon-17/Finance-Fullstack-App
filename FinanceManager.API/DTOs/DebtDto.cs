namespace FinanceManager.API.DTOs
{
    public class DebtDto
    {
        public int Id { get; set; }
        public string Name { get; set; }
        public decimal Balance { get; set; }
        public decimal InterestRate { get; set; }
        public int Installments { get; set; }
        public int PaidInstallments { get; set; }
        public string Color { get; set; }
        public string Icon { get; set; }

        // NUEVO
        public List<InstallmentDto> InstallmentsList { get; set; } = new List<InstallmentDto>();
    }

    public class CreateDebtDto
    {
        public string Name { get; set; }
        [System.ComponentModel.DataAnnotations.Range(0.01, double.MaxValue, ErrorMessage = "Balance must be greater than zero.")]
        public decimal Balance { get; set; }
        public decimal InterestRate { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, int.MaxValue, ErrorMessage = "Installments must be at least 1.")]
        public int Installments { get; set; }
        public string Color { get; set; }
        public string Icon { get; set; }
    }

    public class UpdateDebtDto
    {
        public string Name { get; set; }
        [System.ComponentModel.DataAnnotations.Range(0.01, double.MaxValue, ErrorMessage = "Balance must be greater than zero.")]
        public decimal Balance { get; set; }
        public decimal InterestRate { get; set; }
        [System.ComponentModel.DataAnnotations.Range(1, int.MaxValue, ErrorMessage = "Installments must be at least 1.")]
        public int Installments { get; set; }
        public string Color { get; set; }
        public string Icon { get; set; }
    }
}