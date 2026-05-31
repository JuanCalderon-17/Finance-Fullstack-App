using System.ComponentModel.DataAnnotations;
using FinanceManager.API.Models;

namespace FinanceManager.API.DTOs
{
    public class CreateRecurringDto
    {
        [Required]
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        [Required]
        public string Category { get; set; } = string.Empty;
        public string Currency { get; set; } = "USD";
        public RecurrenceFrequency Frequency { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class UpdateRecurringDto
    {
        [Required]
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        [Required]
        public string Category { get; set; } = string.Empty;
        public string Currency { get; set; } = "USD";
        public RecurrenceFrequency Frequency { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
        public bool IsActive { get; set; } = true;
    }

    public class DueOccurrenceDto
    {
        public int RecurringId { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Currency { get; set; } = "USD";
        public DateTime DueDate { get; set; }
        public int OverdueCount { get; set; }
    }
}
