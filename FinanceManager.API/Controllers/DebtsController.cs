using FinanceManager.API.Data;
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

        [HttpGet]
        public async Task<ActionResult<IEnumerable<Debt>>> GetMyDebts()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            // Ordenamos por ID para que no salten al editar
            return await _context.Debts.Where(d => d.AppUserId == userId).OrderBy(d => d.Id).ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<Debt>> CreateDebt(Debt debt)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            debt.AppUserId = userId;
            _context.Debts.Add(debt);
            await _context.SaveChangesAsync();
            return CreatedAtAction(nameof(GetMyDebts), new { id = debt.Id }, debt);
        }

        // 👇 NUEVO: Método para EDITAR
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateDebt(int id, Debt debt)
        {
            if (id != debt.Id) return BadRequest();

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var existingDebt = await _context.Debts.FirstOrDefaultAsync(d => d.Id == id && d.AppUserId == userId);

            if (existingDebt == null) return NotFound();

            // Actualizamos los campos
            existingDebt.Name = debt.Name;
            existingDebt.Balance = debt.Balance;
            existingDebt.InterestRate = debt.InterestRate;
            existingDebt.Installments = debt.Installments;
            existingDebt.PaidInstallments = debt.PaidInstallments;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteDebt(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var debt = await _context.Debts.FirstOrDefaultAsync(d => d.Id == id && d.AppUserId == userId);
            if (debt == null) return NotFound();

            _context.Debts.Remove(debt);
            await _context.SaveChangesAsync();
            return NoContent();
        }
    }
}