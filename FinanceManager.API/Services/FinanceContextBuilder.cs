using System.Text.Json;
using FinanceManager.API.Data;
using Microsoft.EntityFrameworkCore;

namespace FinanceManager.API.Services
{
    // Reads the authenticated user's finances and serializes a compact JSON
    // summary to inject into the assistant prompt. Kept small on purpose so it
    // stays within free-tier token limits.
    public class FinanceContextBuilder
    {
        private readonly AppDbContext _context;

        public FinanceContextBuilder(AppDbContext context)
        {
            _context = context;
        }

        public async Task<string> BuildAsync(string userId, CancellationToken ct = default)
        {
            // Cap transactions so the payload stays bounded for users with long histories.
            var transactions = await _context.Transactions
                .Where(t => t.AppUserId == userId)
                .OrderByDescending(t => t.TransactionDate)
                .Take(200)
                .Select(t => new
                {
                    date = t.TransactionDate.ToString("yyyy-MM-dd"),
                    description = t.Description,
                    amount = t.Amount,
                    category = t.Category,
                    currency = t.Currency
                })
                .ToListAsync(ct);

            var debts = await _context.Debts
                .Include(d => d.InstallmentsList)
                .Where(d => d.AppUserId == userId)
                .ToListAsync(ct);

            var debtSummary = debts.Select(d => new
            {
                name = d.Name,
                balance = d.Balance,
                interestRate = d.InterestRate,
                totalInstallments = d.Installments,
                paidInstallments = d.PaidInstallments,
                pendingInstallments = d.InstallmentsList.Count(i => !i.IsPaid),
                nextDueDate = d.InstallmentsList
                    .Where(i => !i.IsPaid)
                    .OrderBy(i => i.DueDate)
                    .Select(i => (DateTime?)i.DueDate)
                    .FirstOrDefault(),
                remainingAmount = d.InstallmentsList.Where(i => !i.IsPaid).Sum(i => i.Amount)
            }).ToList();

            var savings = await _context.SavingsAccounts
                .Where(s => s.AppUserId == userId)
                .Select(s => new
                {
                    name = s.Name,
                    balance = s.Balance,
                    goal = s.Goal
                })
                .ToListAsync(ct);

            var payload = new
            {
                today = DateTime.UtcNow.ToString("yyyy-MM-dd"),
                transactions,
                debts = debtSummary,
                savings
            };

            return JsonSerializer.Serialize(payload, new JsonSerializerOptions
            {
                DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
            });
        }
    }
}
