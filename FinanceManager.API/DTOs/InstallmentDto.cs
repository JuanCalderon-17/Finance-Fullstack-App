namespace FinanceManager.API.DTOs
{
    public class InstallmentDto
    {
        public int Id { get; set; }
        public int InstallmentNumber { get; set; }
        public decimal Amount { get; set; }
        public DateTime DueDate { get; set; }
        public bool IsPaid { get; set; }
        public DateTime? PaidDate { get; set; } 
    }

    public class  UpdateInstallmentDto
    {
        public decimal? Amount { get; set; } 
        public DateTime? DueDate { get; set; }
        public bool? IsPaid { get; set; }
        
    }
}
