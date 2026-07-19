using FinanceManager.API.Data; // Asegúrate que este 'using' coincida con la ubicación de tu AppDbContext
using FinanceManager.API.DTOs;
using FinanceManager.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Security.Claims;
using System.Threading.Tasks;

namespace FinanceManager.API.Controllers
{
    [Authorize]
    [Route("api/[controller]")]
    [ApiController]
    public class TransactionsController : ControllerBase
    {
        private readonly AppDbContext _context;

        public TransactionsController(AppDbContext context)
        {
            _context = context;
        }

        // GET: api/Transactions
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Transaction>>> GetTransactions()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier); // Obtenemos el ID del usuario autenticado
            var transactions = await _context.Transactions // Filtramos la base de datos para devolver SOLO las transacciones de ese usuario.
                                             .Where(t => t.AppUserId == userId)
                                             .ToListAsync();
            return transactions;
        }

        // GET: api/Transactions/5
        [HttpGet("{id}")]
        public async Task<ActionResult<Transaction>> GetTransaction(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var transaction = await _context.Transactions.FindAsync(id);

            if (transaction == null)
            {
                return NotFound();
            }
            if (transaction.AppUserId != userId)
            {
                return Forbid();
            }

            return transaction;
        }

        // PUT: api/Transactions/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTransaction(int id, Transaction transaction)
        {
            if (id != transaction.Id)
            {
                return BadRequest();
            }

            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            var originalTransaction = await _context.Transactions.FindAsync(id);

            if (originalTransaction == null)
            {
                return NotFound();
            }

            // Comprobamos la transacción ORIGINAL de la base de datos
            if (originalTransaction.AppUserId != userId)
            {
                return Forbid();
            }

            // Usamos el nombre de variable
            originalTransaction.Description = transaction.Description;
            originalTransaction.Amount = transaction.Amount;
            originalTransaction.TransactionDate = AsUtc(transaction.TransactionDate);
            originalTransaction.Category = transaction.Category;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!TransactionExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // POST: api/Transactions
        [HttpPost]
        public async Task<ActionResult<Transaction>> PostTransaction(CreateTransactionDto transactionDto)
        {
            // 1. Obtenemos el ID del usuario que está haciendo la petición.
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest("No se pudo encontrar el ID de usuario en el token.");
            }

            // 2. Creamos un nuevo objeto Transaction respetando la fecha elegida por el usuario.
            var newTransaction = new Transaction
            {
                Description = transactionDto.Description,
                Amount = transactionDto.Amount,
                TransactionDate = transactionDto.TransactionDate == default
                    ? DateTime.UtcNow
                    : AsUtc(transactionDto.TransactionDate),
                Category = transactionDto.Category,
                Currency = transactionDto.Currency ?? "USD",
                AppUserId = userId
            };

            // 3. Guardamos la nueva transacción en la base de datos.
            _context.Transactions.Add(newTransaction);
            await _context.SaveChangesAsync();

            // Devolvemos la transacción completa que se creó.
            return CreatedAtAction("GetTransaction", new { id = newTransaction.Id }, newTransaction);
        }

        // DELETE: api/Transactions/5
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteTransaction(int id)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            var transaction = await _context.Transactions.FindAsync(id);
            if (transaction == null)
            {
                return NotFound();
            }
            if (transaction.AppUserId != userId) //Verifico si el dueño de la transacción es el mismo usuario
            {
                return Forbid();
            }
            _context.Transactions.Remove(transaction); //Si todo ok, la borramos
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // Npgsql exige Kind=Utc para columnas 'timestamp with time zone';
        // el body llega como "YYYY-MM-DD" y se deserializa con Kind=Unspecified.
        private static DateTime AsUtc(DateTime date)
        {
            var utc = date.Kind == DateTimeKind.Unspecified
                ? DateTime.SpecifyKind(date, DateTimeKind.Utc)
                : date.ToUniversalTime();

            // Una fecha sin hora llega como medianoche; anclarla a mediodía UTC
            // evita que los navegadores en UTC-n la muestren como el día anterior.
            return utc.TimeOfDay == TimeSpan.Zero ? utc.AddHours(12) : utc;
        }

        private bool TransactionExists(int id)
        {
            // Asume que tu modelo Transaction tiene una propiedad 'Id'
            return _context.Transactions.Any(e => e.Id == id);
        }
    }
}
