using FinanceManager.API.Data;
using FinanceManager.API.DTOs;
using FinanceManager.API.Models;
using FinanceManager.API.Services;
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

            debt.InstallmentsList = DebtCalculator.GenerateInstallments(debt);

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
                    var newInstallments = DebtCalculator.GenerateInstallments(
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

            // Re-spread only on payment events: paid-state changed here, or the
            // amount of an already-paid installment was corrected. Editing a
            // PENDING amount stays purely manual (custom plans like 8/8/8/16).
            if (dto.IsPaid.HasValue || (dto.Amount.HasValue && installment.IsPaid))
                DebtCalculator.RebalancePendingInstallments(debt);

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

            DebtCalculator.RebalancePendingInstallments(debt);

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // ================== HELPERS ==================
        // The amortization / rebalancing math lives in DebtCalculator so it can be
        // unit tested without a database. See FinanceManager.API.Tests.

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

    }
}