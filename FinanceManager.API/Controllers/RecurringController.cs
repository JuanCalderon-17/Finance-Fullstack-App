using FinanceManager.API.Data;
using FinanceManager.API.DTOs;
using FinanceManager.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FinanceManager.API.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class RecurringController : ControllerBase
    {
        private readonly AppDbContext _context;

        public RecurringController(AppDbContext context)
        {
            _context = context;
        }

        private string? UserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

        // Npgsql 'timestamp with time zone' requires UTC DateTimes. Date-only values
        // arrive as midnight; anchoring them at noon UTC keeps the calendar day
        // stable in every client timezone (a midnight date renders as the previous
        // day for UTC-n browsers).
        private static DateTime Utc(DateTime d)
        {
            var utc = d.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(d, DateTimeKind.Utc)
                : d.ToUniversalTime();
            return utc.TimeOfDay == TimeSpan.Zero ? utc.AddHours(12) : utc;
        }

        // GET: api/recurring
        [HttpGet]
        public async Task<ActionResult<IEnumerable<RecurringTransaction>>> GetAll()
        {
            return await _context.RecurringTransactions
                .Where(r => r.AppUserId == UserId)
                .OrderByDescending(r => r.IsActive)
                .ThenBy(r => r.NextDueDate)
                .ToListAsync();
        }

        // POST: api/recurring
        [HttpPost]
        public async Task<ActionResult<RecurringTransaction>> Create(CreateRecurringDto dto)
        {
            var userId = UserId;
            if (string.IsNullOrEmpty(userId)) return Unauthorized();

            var start = Utc(dto.StartDate);
            var rule = new RecurringTransaction
            {
                Description = dto.Description,
                Amount = dto.Amount,
                Category = dto.Category,
                Currency = string.IsNullOrEmpty(dto.Currency) ? "USD" : dto.Currency,
                Frequency = dto.Frequency,
                StartDate = start,
                EndDate = dto.EndDate.HasValue ? Utc(dto.EndDate.Value) : null,
                NextDueDate = start,
                IsActive = true,
                AppUserId = userId
            };

            _context.RecurringTransactions.Add(rule);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetAll), new { id = rule.Id }, rule);
        }

        // PUT: api/recurring/5
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, UpdateRecurringDto dto)
        {
            var rule = await _context.RecurringTransactions
                .FirstOrDefaultAsync(r => r.Id == id && r.AppUserId == UserId);
            if (rule == null) return NotFound();

            rule.Description = dto.Description;
            rule.Amount = dto.Amount;
            rule.Category = dto.Category;
            rule.Currency = string.IsNullOrEmpty(dto.Currency) ? "USD" : dto.Currency;
            rule.Frequency = dto.Frequency;
            rule.StartDate = Utc(dto.StartDate);
            rule.EndDate = dto.EndDate.HasValue ? Utc(dto.EndDate.Value) : null;
            rule.IsActive = dto.IsActive;

            // If the schedule moved and NextDueDate falls before the new start, realign it.
            if (rule.NextDueDate < rule.StartDate) rule.NextDueDate = rule.StartDate;

            // If the new EndDate is before the next occurrence, the rule is finished:
            // deactivate it now (otherwise it stays active but never shows as due).
            if (rule.EndDate.HasValue && rule.NextDueDate > rule.EndDate.Value)
                rule.IsActive = false;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/recurring/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var rule = await _context.RecurringTransactions
                .FirstOrDefaultAsync(r => r.Id == id && r.AppUserId == UserId);
            if (rule == null) return NotFound();

            _context.RecurringTransactions.Remove(rule);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // GET: api/recurring/due  — virtual pending occurrences (NextDueDate <= today)
        [HttpGet("due")]
        public async Task<ActionResult<IEnumerable<DueOccurrenceDto>>> GetDue()
        {
            var today = DateTime.UtcNow.Date;
            // Inclusive end-of-day cutoff: due dates are stored at noon UTC, so
            // comparing against midnight would miss the ones due today.
            var cutoff = today.AddDays(1);

            var rules = await _context.RecurringTransactions
                .Where(r => r.AppUserId == UserId && r.IsActive && r.NextDueDate < cutoff)
                .ToListAsync();

            var due = rules
                .Where(r => !r.EndDate.HasValue || r.NextDueDate <= r.EndDate.Value)
                .Select(r => new DueOccurrenceDto
                {
                    RecurringId = r.Id,
                    Description = r.Description,
                    Amount = r.Amount,
                    Category = r.Category,
                    Currency = r.Currency,
                    DueDate = r.NextDueDate,
                    OverdueCount = CountDueOccurrences(r, today)
                })
                .OrderBy(d => d.DueDate)
                .ToList();

            return due;
        }

        // POST: api/recurring/5/confirm — post the earliest due occurrence as a real transaction
        [HttpPost("{id}/confirm")]
        public async Task<ActionResult<Transaction>> Confirm(int id)
        {
            var userId = UserId;
            var rule = await _context.RecurringTransactions
                .FirstOrDefaultAsync(r => r.Id == id && r.AppUserId == userId);
            if (rule == null) return NotFound();

            var transaction = new Transaction
            {
                Description = rule.Description,
                Amount = rule.Amount,
                Category = rule.Category,
                Currency = rule.Currency,
                // Utc() re-anchors legacy midnight due dates at noon so the posted
                // transaction lands on the right calendar day in every timezone.
                TransactionDate = Utc(rule.NextDueDate),
                AppUserId = userId!
            };
            _context.Transactions.Add(transaction);

            AdvanceRule(rule);
            await _context.SaveChangesAsync();

            return Ok(transaction);
        }

        // POST: api/recurring/5/skip — advance the schedule without posting
        [HttpPost("{id}/skip")]
        public async Task<IActionResult> Skip(int id)
        {
            var rule = await _context.RecurringTransactions
                .FirstOrDefaultAsync(r => r.Id == id && r.AppUserId == UserId);
            if (rule == null) return NotFound();

            AdvanceRule(rule);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Advance NextDueDate by one period; deactivate once it passes EndDate.
        private static void AdvanceRule(RecurringTransaction rule)
        {
            rule.NextDueDate = RecurringTransaction.Advance(rule.NextDueDate, rule.Frequency);
            if (rule.EndDate.HasValue && rule.NextDueDate > rule.EndDate.Value)
                rule.IsActive = false;
        }

        // How many occurrences are due on/before today (cap to avoid runaway loops).
        private static int CountDueOccurrences(RecurringTransaction rule, DateTime today)
        {
            int count = 0;
            var d = rule.NextDueDate;
            while (d.Date <= today && count < 600)
            {
                if (rule.EndDate.HasValue && d > rule.EndDate.Value) break;
                count++;
                d = RecurringTransaction.Advance(d, rule.Frequency);
            }
            return count;
        }
    }
}
