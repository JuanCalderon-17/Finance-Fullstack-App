using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using FinanceManager.API.Models;

namespace FinanceManager.API.Data
{
    public class AppDbContext : IdentityDbContext<AppUser>
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options) { }

        public DbSet<Transaction> Transactions { get; set; }
        public DbSet<SavingsAccount> SavingsAccounts { get; set; }
        public DbSet<Debt> Debts { get; set; }
        public DbSet<Installment> Installments { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder); // NO quitar nunca

            // Transaction
            modelBuilder.Entity<Transaction>()
                .Property(t => t.Amount)
                .HasPrecision(18, 4);

            // Debt -> Installments (1 a muchos)
            modelBuilder.Entity<Debt>()
                .HasMany(d => d.InstallmentsList)
                .WithOne(i => i.Debt)
                .HasForeignKey(i => i.DebtId)
                .OnDelete(DeleteBehavior.Cascade);

            // Decimales (PostgreSQL)
            modelBuilder.Entity<Debt>()
                .Property(d => d.Balance)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Debt>()
                .Property(d => d.InterestRate)
                .HasPrecision(5, 2);

            modelBuilder.Entity<Installment>()
                .Property(i => i.Amount)
                .HasPrecision(18, 2);

            modelBuilder.Entity<SavingsAccount>()
                .Property(s => s.Balance)
                .HasPrecision(18, 2);

            modelBuilder.Entity<SavingsAccount>()
                .Property(s => s.Goal)
                .HasPrecision(18, 2);
        }
    }
}
