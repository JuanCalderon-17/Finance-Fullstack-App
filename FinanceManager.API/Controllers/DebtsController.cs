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
            return await _context.Debts.Where(d => d.AppUserId == userId).ToListAsync();
        }

        [HttpPost]
        public async Task<ActionResult<Debt>> CreateDebt(Debt debt)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            debt.AppUserId = userId; // Asignamos el dueño aquí automáticamente

            _context.Debts.Add(debt);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMyDebts), new { id = debt.Id }, debt);
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