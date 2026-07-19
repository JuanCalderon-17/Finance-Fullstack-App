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
    public class DebtsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public DebtsController(AppDbContext context)
        {
            _context = context;
        }

        private string GetUserId() =>
            User.FindFirstValue(ClaimTypes.NameIdentifier)!;

        // GET: api/debts
        [HttpGet]
        public async Task<ActionResult<IEnumerable<DebtDto>>> GetDebts()
        {
            var userId = GetUserId();

            var debts = await _context.Debts
                .Include(d => d.InstallmentsList.OrderBy(i => i.InstallmentNumber))
                .Where(d => d.AppUserId == userId) // ← CAMBIADO
                .ToListAsync();

            return Ok(debts.Select(MapToDto));
        }

        // GET: api/debts/5
        [HttpGet("{id}")]
        public async Task<ActionResult<DebtDto>> GetDebt(int id)
        {
            var userId = GetUserId();

            var debt = await _context.Debts
                .Include(d => d.InstallmentsList.OrderBy(i => i.InstallmentNumber))
                .FirstOrDefaultAsync(d => d.Id == id && d.AppUserId == userId); // ← CAMBIADO

            if (debt == null) return NotFound();

            return Ok(MapToDto(debt));
        }

        // POST: api/debts
        [HttpPost]
        public async Task<ActionResult<DebtDto>> CreateDebt(CreateDebtDto dto)
        {
            var userId = GetUserId();

            var debt = new Debt
            {
                AppUserId = userId,
                Name = dto.Name,
                Balance = dto.OriginalBalance,
                InterestRate = dto.InterestRate,
                Installments = dto.Installments,
                Color = dto.Color,
                Icon = dto.Icon
            };

            debt.InstallmentsList = GenerateInstallments(debt);

            _context.Debts.Add(debt);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetDebt), new { id = debt.Id }, MapToDto(debt));
        }

        // PUT: api/debts/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDebt(int id, UpdateDebtDto dto)
        {
            var userId = GetUserId();

            var debt = await _context.Debts
                .Include(d => d.InstallmentsList)
                .FirstOrDefaultAsync(d => d.Id == id && d.AppUserId == userId);

            if (debt == null) return NotFound();

            int paidCount = debt.InstallmentsList.Count(i => i.IsPaid);

            if (dto.Installments < paidCount)
                return BadRequest($"Cannot reduce installments to {dto.Installments}: {paidCount} are already paid.");

            bool financialParamsChanged =
                debt.Balance != dto.OriginalBalance ||
                debt.InterestRate != dto.InterestRate ||
                debt.Installments != dto.Installments;

            debt.Name = dto.Name;
            debt.Balance = dto.OriginalBalance;
            debt.InterestRate = dto.InterestRate;
            debt.Installments = dto.Installments;
            debt.Color = dto.Color;
            debt.Icon = dto.Icon;

            if (financialParamsChanged)
            {
                // Preserve the original payment schedule: installment #k was due at anchor+k months,
                // so regenerated installments keep their dates instead of restarting from "today".
                var firstInstallment = debt.InstallmentsList
                    .OrderBy(i => i.InstallmentNumber)
                    .FirstOrDefault();
                DateTime? scheduleAnchor = firstInstallment != null
                    ? firstInstallment.DueDate.AddMonths(-firstInstallment.InstallmentNumber)
                    : (DateTime?)null;

                decimal paidTotal = debt.InstallmentsList.Where(i => i.IsPaid).Sum(i => i.Amount);

                // Remove only unpaid installments — paid ones are historical records
                var unpaid = debt.InstallmentsList.Where(i => !i.IsPaid).ToList();
                _context.Installments.RemoveRange(unpaid);
                foreach (var inst in unpaid)
                    debt.InstallmentsList.Remove(inst);

                int remainingCount = dto.Installments - paidCount;
                if (remainingCount > 0)
                {
                    var newInstallments = GenerateInstallments(
                        debt,
                        startNumber: paidCount + 1,
                        count: remainingCount,
                        anchorDate: scheduleAnchor,
                        alreadyPaidTotal: paidTotal);
                    foreach (var inst in newInstallments)
                        debt.InstallmentsList.Add(inst);
                }
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/debts/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDebt(int id)
        {
            var userId = GetUserId();

            var debt = await _context.Debts
                .FirstOrDefaultAsync(d => d.Id == id && d.AppUserId == userId); // ← CAMBIADO

            if (debt == null) return NotFound();

            _context.Debts.Remove(debt);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT: api/debts/{debtId}/installments/{installmentId}
        [HttpPut("{debtId}/installments/{installmentId}")]
        public async Task<IActionResult> UpdateInstallment(
            int debtId,
            int installmentId,
            UpdateInstallmentDto dto)
        {
            var userId = GetUserId();

            var debt = await _context.Debts
                .Include(d => d.InstallmentsList)
                .FirstOrDefaultAsync(d => d.Id == debtId && d.AppUserId == userId); // ← CAMBIADO

            if (debt == null) return NotFound("Debt not found");

            var installment = debt.InstallmentsList.FirstOrDefault(i => i.Id == installmentId);
            if (installment == null) return NotFound("Installment not found");

            if (dto.Amount.HasValue) installment.Amount = dto.Amount.Value;
            if (dto.DueDate.HasValue) installment.DueDate = dto.DueDate.Value;
            if (dto.IsPaid.HasValue)
            {
                installment.IsPaid = dto.IsPaid.Value;
                installment.PaidDate = dto.IsPaid.Value ? DateTime.UtcNow : null;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // PUT: api/debts/{debtId}/installments/{installmentId}/toggle
        [HttpPut("{debtId}/installments/{installmentId}/toggle")]
        public async Task<IActionResult> ToggleInstallmentPaid(int debtId, int installmentId)
        {
            var userId = GetUserId();

            var debt = await _context.Debts
                .Include(d => d.InstallmentsList)
                .FirstOrDefaultAsync(d => d.Id == debtId && d.AppUserId == userId); // ← CAMBIADO

            if (debt == null) return NotFound();

            var installment = debt.InstallmentsList.FirstOrDefault(i => i.Id == installmentId);
            if (installment == null) return NotFound();

            installment.IsPaid = !installment.IsPaid;
            installment.PaidDate = installment.IsPaid ? DateTime.UtcNow : null;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ================== HELPERS ==================

        private DebtDto MapToDto(Debt debt)
        {
            return new DebtDto
            {
                Id = debt.Id,
                Name = debt.Name,
                OriginalBalance = debt.Balance,
                CurrentBalance = debt.InstallmentsList.Sum(i => i.Amount),
                InterestRate = debt.InterestRate,
                Installments = debt.Installments,
                PaidInstallments = debt.InstallmentsList.Count(i => i.IsPaid),
                Color = debt.Color,
                Icon = debt.Icon,
                InstallmentsList = debt.InstallmentsList.Select(i => new InstallmentDto
                {
                    Id = i.Id,
                    InstallmentNumber = i.InstallmentNumber,
                    Amount = i.Amount,
                    DueDate = i.DueDate,
                    IsPaid = i.IsPaid,
                    PaidDate = i.PaidDate
                }).ToList()
            };
        }

        private List<Installment> GenerateInstallments(
            Debt debt,
            int startNumber = 1,
            int? count = null,
            DateTime? anchorDate = null,
            decimal alreadyPaidTotal = 0)
        {
            var installments = new List<Installment>();
            int totalCount = count ?? debt.Installments;
            decimal monthlyPayment;

            // Monthly payment is always calculated from the full debt (balance + total installments)
            if (debt.InterestRate > 0)
            {
                var r = (double)(debt.InterestRate / 12 / 100);
                var n = debt.Installments;
                var numerator = r * Math.Pow(1 + r, n);
                var denominator = Math.Pow(1 + r, n) - 1;
                monthlyPayment = debt.Balance * (decimal)(numerator / denominator);
            }
            else
            {
                monthlyPayment = debt.Balance / debt.Installments;
            }

            var startDate = anchorDate ?? DateTime.UtcNow.Date;

            for (int i = 0; i < totalCount; i++)
            {
                int number = startNumber + i;
                installments.Add(new Installment
                {
                    InstallmentNumber = number,
                    // Installment #k is always due k months after the schedule anchor,
                    // so partial regeneration keeps the original due dates.
                    Amount = Math.Round(monthlyPayment, 2),
                    DueDate = startDate.AddMonths(number),
                    IsPaid = false
                });
            }

            // The whole series (already-paid + generated) must sum to the expected total;
            // the last generated installment absorbs rounding drift and any difference
            // left by manually edited paid amounts (e.g. the user paid 8/8/8 → last = 16).
            var expectedTotal = Math.Round(monthlyPayment * debt.Installments, 2);
            var diff = expectedTotal - alreadyPaidTotal - installments.Sum(i => i.Amount);
            if (diff != 0)
            {
                var adjusted = Math.Round(installments[^1].Amount + diff, 2);
                installments[^1].Amount = Math.Max(0, adjusted);
            }

            return installments;
        }
    }
}