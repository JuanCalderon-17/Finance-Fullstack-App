using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FinanceManager.API.Models
{
    public enum RecurrenceFrequency
    {
        Weekly = 0,
        Biweekly = 1,
        Monthly = 2,
        Yearly = 3
    }

    public class RecurringTransaction
    {
        public int Id { get; set; }
        public string Description { get; set; } = string.Empty;
        public decimal Amount { get; set; }
        public string Category { get; set; } = string.Empty;
        public string Currency { get; set; } = "USD";

        public RecurrenceFrequency Frequency { get; set; }

        public DateTime StartDate { get; set; }      // first occurrence (anchor)
        public DateTime? EndDate { get; set; }        // optional end
        public DateTime NextDueDate { get; set; }     // earliest un-actioned occurrence
        public bool IsActive { get; set; } = true;

        [Required]
        public string AppUserId { get; set; } = string.Empty;

        [ForeignKey("AppUserId")]
        public AppUser? AppUser { get; set; }

        /// <summary>Returns the given date advanced by one period of this rule's frequency.</summary>
        public static DateTime Advance(DateTime date, RecurrenceFrequency frequency) => frequency switch
        {
            RecurrenceFrequency.Weekly => date.AddDays(7),
            RecurrenceFrequency.Biweekly => date.AddDays(14),
            RecurrenceFrequency.Monthly => date.AddMonths(1),
            RecurrenceFrequency.Yearly => date.AddYears(1),
            _ => date.AddMonths(1)
        };
    }
}
