using FinanceManager.API.Models;
using FinanceManager.API.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using System.Security.Claims;



namespace FinanceManager.API.Controllers
{
    public class SavingsController
    {
        [Authorize]
        [Route("api/[controller]")]
        [ApiController]

        public class SavingsAccountsController : ControllerBase
        {
            private readonly AppDbContext _context;
            private readonly UserManager<AppUser> _userManager;
            public SavingsAccountsController(AppDbContext context, UserManager<AppUser> userManager)
            {
                _context = context;
                _userManager = userManager;
            }
            // GET: api/SavingsAccounts
            [HttpGet]
            public async Task<ActionResult<IEnumerable<SavingsAccount>>> GetMySavings()
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                return await _context.SavingsAccounts
                    .Where(s => s.AppUserId == userId)
                    .ToListAsync();
            }

            // POST: api/SavingsAccounts
            [HttpPost]
            public async Task<ActionResult<SavingsAccount>> PostSavingsAccount(SavingsAccount saving)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
                saving.AppUserId = userId;

                _context.SavingsAccounts.Add(saving);
                await _context.SaveChangesAsync();

                return CreatedAtAction(nameof(GetMySavings), new { id = saving.Id }, saving);
            }



            [HttpPut("{id}")]
            public async Task<IActionResult> UpdateSaving(int id, SavingsAccount saving)
            {
                if (id != saving.Id) return BadRequest();

                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

                // Verificamos que la cuenta pertenezca al usuario antes de editarla
                var existingAccount = await _context.SavingsAccounts
                    .FirstOrDefaultAsync(s => s.Id == id && s.AppUserId == userId);

                if (existingAccount == null) return NotFound("Cuenta no encontrada o no te pertenece.");

                // Actualizamos los datos
                existingAccount.Name = saving.Name;
                existingAccount.Balance = saving.Balance;
                existingAccount.Color = saving.Color;
                // No actualizamos AppUserId para evitar robos

                await _context.SaveChangesAsync();
                return NoContent();
            }


            [HttpDelete("{id}")]
            public async Task<IActionResult> DeleteSaving(int id)
            {
                var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

                var saving = await _context.SavingsAccounts
                    .FirstOrDefaultAsync(s => s.Id == id && s.AppUserId == userId);

                if (saving == null) return NotFound("Cuenta no encontrada o no te pertenece.");
                _context.SavingsAccounts.Remove(saving);
                await _context.SaveChangesAsync();
                return NoContent();
            }
        }
    }
}
