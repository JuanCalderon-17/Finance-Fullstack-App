namespace FinanceManager.API.Models
{
    public class Installment
    {
        public int Id { get; set; }
        public int DebtId { get; set; }
        public int InstallmentNumber { get; set; }
        public decimal Amount { get; set; }
        public DateTime DueDate { get; set; }
        public bool IsPaid { get; set; }
        public DateTime? PaidDate { get; set; }

        // Navegación
        public Debt Debt { get; set; }
    }
}
