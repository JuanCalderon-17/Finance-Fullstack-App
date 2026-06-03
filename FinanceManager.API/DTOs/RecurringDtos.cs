using System.ComponentModel.DataAnnotations;
using FinanceManager.API.Models;

namespace FinanceManager.API.DTOs
{
    public class CreateRecurringDto
    {
        [Required]
        [StringLength(200, MinimumLength = 1)]
        public string Description { get; set; } = string.Empty;
        [Range(0.01, 999999999)]
        public decimal Amount { get; set; }
        [Required]
        [StringLength(50)]
        public string Category { get; set; } = string.Empty;
        [StringLength(3)]
        public string Currency { get; set; } = "USD";
        public RecurrenceFrequency Frequency { get; set; }
        public DateTime StartDate { get; set; }
        public DateTime? EndDate { get; set; }
    }

    public class UpdateRecurringDto
    {
        [Required]
        [StringLength(200, MinimumLength = 1)]
        public string Description { get; set; } = string.Empty;
        [Range(0.01, 999999999)]
        public decimal Amount { get; set; }
        [Required]
        [StringLength(50)]
        public string Category { get; set; } = string.Empty;
        [StringLength(3)]
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
