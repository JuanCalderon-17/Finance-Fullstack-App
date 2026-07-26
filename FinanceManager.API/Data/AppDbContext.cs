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
        public DbSet<RecurringTransaction> RecurringTransactions { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Relations

            // Debt -> User
            modelBuilder.Entity<Debt>()
                .HasOne(d => d.User)
                .WithMany()
                .HasForeignKey(d => d.AppUserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Debt -> Installments
            modelBuilder.Entity<Debt>()
                .HasMany(d => d.InstallmentsList)
                .WithOne(i => i.Debt)
                .HasForeignKey(i => i.DebtId)
                .OnDelete(DeleteBehavior.Cascade);

            // SavingsAccount -> User
            // Configured explicitly because AppUserId is nullable here, unlike every other
            // user-owned table. EF's convention for an optional relationship is ClientSetNull,
            // so this FK was the only one created without ON DELETE CASCADE — which meant
            // deleting an account that had ever held a savings account failed on a foreign
            // key violation and surfaced to the user as a 500.
            modelBuilder.Entity<SavingsAccount>()
                .HasOne(s => s.AppUser)
                .WithMany()
                .HasForeignKey(s => s.AppUserId)
                .OnDelete(DeleteBehavior.Cascade);

            // Dcimals "Postgres"
            // Transaction
            modelBuilder.Entity<Transaction>()
                .Property(t => t.Amount)
                .HasPrecision(18, 4);

            // Debt
            modelBuilder.Entity<Debt>()
                .Property(d => d.Balance)
                .HasPrecision(18, 2);

            modelBuilder.Entity<Debt>()
                .Property(d => d.InterestRate)
                .HasPrecision(5, 2);

            // Installment
            modelBuilder.Entity<Installment>()
                .Property(i => i.Amount)
                .HasPrecision(18, 2);

            // RecurringTransaction
            modelBuilder.Entity<RecurringTransaction>()
                .Property(r => r.Amount)
                .HasPrecision(18, 4);

            modelBuilder.Entity<RecurringTransaction>()
                .HasIndex(r => new { r.AppUserId, r.NextDueDate })
                .HasDatabaseName("IX_RecurringTransactions_AppUserId_NextDueDate");

            // SavingsAccount
            modelBuilder.Entity<SavingsAccount>()
                .Property(s => s.Balance)
                .HasPrecision(18, 2);

            modelBuilder.Entity<SavingsAccount>()
                .Property(s => s.Goal)
                .HasPrecision(18, 2);

            // ============ INDICES ============

            // Transaction
            modelBuilder.Entity<Transaction>()
                .HasIndex(t => new { t.AppUserId, t.TransactionDate })
                .HasDatabaseName("IX_Transactions_AppUserId_Date");

            // Transaction
            modelBuilder.Entity<Transaction>()
                .HasIndex(t => new { t.AppUserId, t.Category })
                .HasDatabaseName("IX_Transactions_AppUserId_Category");

            // Debt: filtrar deudas por usuario
            modelBuilder.Entity<Debt>()
                .HasIndex(d => d.AppUserId)
                .HasDatabaseName("IX_Debts_AppUserId");

            // Installment: filtrar cuotas por deuda
            modelBuilder.Entity<Installment>()
                .HasIndex(i => i.DebtId)
                .HasDatabaseName("IX_Installments_DebtId");

            // SavingsAccount: filtrar cuentas por usuario
            modelBuilder.Entity<SavingsAccount>()
                .HasIndex(s => s.AppUserId)
                .HasDatabaseName("IX_SavingsAccounts_AppUserId");
        }
    }
}
