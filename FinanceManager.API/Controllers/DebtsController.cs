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
                AppUserId = userId, // ← CAMBIADO
                Name = dto.Name,
                Balance = dto.Balance,
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
                .FirstOrDefaultAsync(d => d.Id == id && d.AppUserId == userId); // ← CAMBIADO

            if (debt == null) return NotFound();

            debt.Name = dto.Name;
            debt.Balance = dto.Balance;
            debt.InterestRate = dto.InterestRate;
            debt.Color = dto.Color;
            debt.Icon = dto.Icon;

            if (debt.Installments != dto.Installments)
            {
                debt.Installments = dto.Installments;
                _context.Installments.RemoveRange(debt.InstallmentsList);
                debt.InstallmentsList = GenerateInstallments(debt);
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
                Balance = debt.Balance,
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

        private List<Installment> GenerateInstallments(Debt debt)
        {
            var installments = new List<Installment>();
            decimal monthlyPayment;

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

            var startDate = DateTime.UtcNow.Date;

            for (int i = 1; i <= debt.Installments; i++)
            {
                installments.Add(new Installment
                {
                    InstallmentNumber = i,
                    Amount = Math.Round(monthlyPayment, 2),
                    DueDate = startDate.AddMonths(i),
                    IsPaid = false
                });
            }

            return installments;
        }
    }
}