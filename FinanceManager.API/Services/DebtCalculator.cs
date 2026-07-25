using FinanceManager.API.Models;

namespace FinanceManager.API.Services
{
    /// <summary>
    /// Pure amortization / installment math for debts. Deliberately free of EF and
    /// HTTP concerns so it can be unit tested directly — this is the money-critical
    /// code, a rounding slip here is a wrong number shown to the user.
    /// </summary>
    public static class DebtCalculator
    {
        /// <summary>
        /// Monthly payment for the FULL debt. With interest it is the standard
        /// amortization formula (annual rate given as a percentage, e.g. 12 => 12%),
        /// otherwise the balance split evenly across the installments.
        /// </summary>
        public static decimal MonthlyPayment(decimal balance, decimal annualInterestRate, int installments)
        {
            if (installments <= 0)
                throw new ArgumentOutOfRangeException(nameof(installments), "A debt needs at least one installment.");

            if (annualInterestRate > 0)
            {
                var r = (double)(annualInterestRate / 12 / 100);
                var n = installments;
                var numerator = r * Math.Pow(1 + r, n);
                var denominator = Math.Pow(1 + r, n) - 1;
                return balance * (decimal)(numerator / denominator);
            }

            return balance / installments;
        }

        /// <summary>
        /// Total the whole series must sum to: amortized total when there is
        /// interest, plain balance otherwise (mirrors <see cref="GenerateInstallments"/>).
        /// </summary>
        public static decimal ExpectedTotal(Debt debt)
        {
            if (debt.InterestRate > 0)
                return Math.Round(MonthlyPayment(debt.Balance, debt.InterestRate, debt.Installments) * debt.Installments, 2);

            return debt.Balance;
        }

        /// <summary>
        /// Builds an installment schedule for <paramref name="debt"/>.
        /// </summary>
        /// <param name="startNumber">Number of the first installment to generate (1-based).</param>
        /// <param name="count">How many to generate; defaults to the debt's full installment count.</param>
        /// <param name="anchorDate">
        /// Schedule origin: installment #k is due k months after it. Defaults to today (UTC),
        /// so a partial regeneration can keep the original due dates by passing the old anchor.
        /// </param>
        /// <param name="alreadyPaidTotal">Sum of the paid installments that are being kept.</param>
        public static List<Installment> GenerateInstallments(
            Debt debt,
            int startNumber = 1,
            int? count = null,
            DateTime? anchorDate = null,
            decimal alreadyPaidTotal = 0)
        {
            var installments = new List<Installment>();
            int totalCount = count ?? debt.Installments;
            if (totalCount <= 0) return installments;

            // Monthly payment is always calculated from the full debt (balance + total installments)
            decimal monthlyPayment = MonthlyPayment(debt.Balance, debt.InterestRate, debt.Installments);

            var startDate = anchorDate ?? DateTime.UtcNow.Date;

            for (int i = 0; i < totalCount; i++)
            {
                int number = startNumber + i;
                // Installment #k is always due k months after the schedule anchor,
                // so partial regeneration keeps the original due dates. Midnight
                // dates get anchored at noon UTC so UTC-n browsers don't render
                // them as the previous day.
                var due = startDate.AddMonths(number);
                if (due.TimeOfDay == TimeSpan.Zero)
                    due = due.AddHours(12);

                installments.Add(new Installment
                {
                    InstallmentNumber = number,
                    Amount = Math.Round(monthlyPayment, 2),
                    DueDate = due,
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

        /// <summary>
        /// After paying a different-than-scheduled amount, spread the real
        /// outstanding balance evenly across the pending installments so each
        /// row shows what is actually still owed. No-op when the schedule
        /// already covers the balance (paying the exact amount moves nothing).
        /// </summary>
        public static void RebalancePendingInstallments(Debt debt)
        {
            var pending = debt.InstallmentsList
                .Where(i => !i.IsPaid)
                .OrderBy(i => i.InstallmentNumber)
                .ToList();
            if (pending.Count == 0) return;

            var paidTotal = debt.InstallmentsList.Where(i => i.IsPaid).Sum(i => i.Amount);
            var remaining = ExpectedTotal(debt) - paidTotal;
            var pendingTotal = pending.Sum(i => i.Amount);

            if (Math.Abs(remaining - pendingTotal) <= 0.01m) return;

            if (remaining <= 0)
            {
                // Overpaid: nothing left to owe on the pending rows.
                foreach (var i in pending) i.Amount = 0;
                return;
            }

            var share = Math.Round(remaining / pending.Count, 2);
            foreach (var i in pending) i.Amount = share;
            // Last pending installment absorbs the rounding remainder.
            pending[^1].Amount = Math.Max(0, Math.Round(remaining - share * (pending.Count - 1), 2));
        }
    }
}
