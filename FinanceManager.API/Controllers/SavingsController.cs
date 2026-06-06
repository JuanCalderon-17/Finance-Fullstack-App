using FinanceManager.API.Data;
using FinanceManager.API.DTOs;
using FinanceManager.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace FinanceManager.API.Controllers
{
    [Authorize] // 🔒 Protege la ruta: solo usuarios logueados
    [Route("api/[controller]")] // Esto crea la ruta: api/savings
    [ApiController]
    public class SavingsController : ControllerBase
    {
        private readonly AppDbContext _context;
        private readonly UserManager<AppUser> _userManager;

        public SavingsController(AppDbContext context, UserManager<AppUser> userManager)
        {
            _context = context;
            _userManager = userManager;
        }

        // GET: api/savings
        [HttpGet]
        public async Task<ActionResult<IEnumerable<SavingsAccount>>> GetMySavings()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            return await _context.SavingsAccounts
                .Where(s => s.AppUserId == userId)
                .ToListAsync();
        }

        // POST: api/savings
        [HttpPost]
        public async Task<ActionResult<SavingsAccount>> CreateSaving(SavingsDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var saving = new SavingsAccount
            {
                Name = dto.Name,
                Balance = dto.Balance,
                Goal = dto.Goal,
                Color = dto.Color,
                Icon = dto.Icon,
                AppUserId = userId
            };

            _context.SavingsAccounts.Add(saving);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMySavings), new { id = saving.Id }, saving);
        }

        // PUT: api/savings/5
        [HttpPut("{id}")]
        public async Task<IActionResult> UpdateSaving(int id, SavingsDto dto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var existingAccount = await _context.SavingsAccounts
                .FirstOrDefaultAsync(s => s.Id == id && s.AppUserId == userId);

            if (existingAccount == null) return NotFound("Cuenta no encontrada o no te pertenece.");

            existingAccount.Name = dto.Name;
            existingAccount.Balance = dto.Balance;
            existingAccount.Color = dto.Color;
            existingAccount.Icon = dto.Icon;

            // Only overwrite the goal when the client actually sends one, so an
            // update that omits it (the UI doesn't expose goals yet) can't wipe it.
            if (dto.Goal.HasValue) existingAccount.Goal = dto.Goal;

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE: api/savings/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSaving(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var saving = await _context.SavingsAccounts
                .FirstOrDefaultAsync(s => s.Id == id && s.AppUserId == userId);

            if (saving == null) return NotFound();

            _context.SavingsAccounts.Remove(saving);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}