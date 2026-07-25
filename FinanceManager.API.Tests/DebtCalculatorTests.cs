using FinanceManager.API.Models;
using FinanceManager.API.Services;

namespace FinanceManager.API.Tests;

/// <summary>
/// Reference values were computed independently from the amortization formula
/// P = B * (r(1+r)^n) / ((1+r)^n - 1), with r = annualRate / 12 / 100.
/// </summary>
public class DebtCalculatorTests
{
    private static Debt MakeDebt(decimal balance, decimal rate, int installments) => new()
    {
        Id = 1,
        AppUserId = "user-1",
        Name = "Test debt",
        Balance = balance,
        InterestRate = rate,
        Installments = installments,
        Color = "#000",
        Icon = "bi-credit-card"
    };

    // ===================== MonthlyPayment =====================

    [Fact]
    public void MonthlyPayment_WithoutInterest_SplitsBalanceEvenly()
    {
        Assert.Equal(100m, DebtCalculator.MonthlyPayment(1200m, 0m, 12));
    }

    [Theory]
    [InlineData(1000, 12, 12, 88.85)]
    [InlineData(5000, 24, 24, 264.36)]
    [InlineData(10000, 7.5, 36, 311.06)]
    public void MonthlyPayment_WithInterest_MatchesAmortizationFormula(
        decimal balance, decimal rate, int installments, decimal expectedRounded)
    {
        var monthly = DebtCalculator.MonthlyPayment(balance, rate, installments);
        Assert.Equal(expectedRounded, Math.Round(monthly, 2));
    }

    [Fact]
    public void MonthlyPayment_WithZeroInstallments_Throws()
    {
        // Guards the divide-by-zero that would otherwise 500 the API.
        Assert.Throws<ArgumentOutOfRangeException>(() => DebtCalculator.MonthlyPayment(1000m, 0m, 0));
    }

    // ===================== ExpectedTotal =====================

    [Fact]
    public void ExpectedTotal_WithoutInterest_EqualsBalance()
    {
        Assert.Equal(1200m, DebtCalculator.ExpectedTotal(MakeDebt(1200m, 0m, 12)));
    }

    [Theory]
    [InlineData(1000, 12, 12, 1066.19)]
    [InlineData(5000, 24, 24, 6344.53)]
    [InlineData(10000, 7.5, 36, 11198.24)]
    public void ExpectedTotal_WithInterest_IsAmortizedTotal(
        decimal balance, decimal rate, int installments, decimal expected)
    {
        Assert.Equal(expected, DebtCalculator.ExpectedTotal(MakeDebt(balance, rate, installments)));
    }

    [Fact]
    public void ExpectedTotal_WithInterest_IsGreaterThanPrincipal()
    {
        var debt = MakeDebt(1000m, 12m, 12);
        Assert.True(DebtCalculator.ExpectedTotal(debt) > debt.Balance);
    }

    // ===================== GenerateInstallments =====================

    [Fact]
    public void GenerateInstallments_ProducesOneRowPerInstallment_NumberedFromOne()
    {
        var debt = MakeDebt(1200m, 0m, 12);

        var schedule = DebtCalculator.GenerateInstallments(debt);

        Assert.Equal(12, schedule.Count);
        Assert.Equal(Enumerable.Range(1, 12), schedule.Select(i => i.InstallmentNumber));
        Assert.All(schedule, i => Assert.False(i.IsPaid));
        Assert.All(schedule, i => Assert.Null(i.PaidDate));
    }

    [Fact]
    public void GenerateInstallments_WithoutInterest_SumsExactlyToBalance()
    {
        var debt = MakeDebt(1200m, 0m, 12);

        var schedule = DebtCalculator.GenerateInstallments(debt);

        Assert.Equal(1200m, schedule.Sum(i => i.Amount));
        Assert.All(schedule, i => Assert.Equal(100m, i.Amount));
    }

    [Fact]
    public void GenerateInstallments_NonDivisibleBalance_PutsTheLostCentOnTheLastInstallment()
    {
        // 100 / 3 = 33.333... — naive rounding would lose a cent and show 99.99 owed.
        var debt = MakeDebt(100m, 0m, 3);

        var schedule = DebtCalculator.GenerateInstallments(debt);

        Assert.Equal(new[] { 33.33m, 33.33m, 33.34m }, schedule.Select(i => i.Amount));
        Assert.Equal(100m, schedule.Sum(i => i.Amount));
    }

    [Theory]
    [InlineData(1000, 12, 12, 88.85, 88.84, 1066.19)]
    [InlineData(5000, 24, 24, 264.36, 264.25, 6344.53)]
    [InlineData(10000, 7.5, 36, 311.06, 311.14, 11198.24)]
    public void GenerateInstallments_WithInterest_SpreadsAmortizedTotalAndAbsorbsDriftOnTheLastRow(
        decimal balance, decimal rate, int installments,
        decimal expectedRegularAmount, decimal expectedLastAmount, decimal expectedTotal)
    {
        var debt = MakeDebt(balance, rate, installments);

        var schedule = DebtCalculator.GenerateInstallments(debt);

        Assert.All(schedule.Take(installments - 1), i => Assert.Equal(expectedRegularAmount, i.Amount));
        Assert.Equal(expectedLastAmount, schedule[^1].Amount);
        Assert.Equal(expectedTotal, schedule.Sum(i => i.Amount));
    }

    [Theory]
    [InlineData(1234.56, 0, 7)]
    [InlineData(999.99, 0, 13)]
    [InlineData(1000, 12, 12)]
    [InlineData(3333.33, 18.5, 9)]
    [InlineData(750, 5, 5)]
    public void GenerateInstallments_AlwaysSumsToExpectedTotal(decimal balance, decimal rate, int installments)
    {
        // The invariant that matters: the schedule the user sees must add up to
        // what they actually owe — no cent may be created or lost by rounding.
        var debt = MakeDebt(balance, rate, installments);

        var schedule = DebtCalculator.GenerateInstallments(debt);

        Assert.Equal(DebtCalculator.ExpectedTotal(debt), schedule.Sum(i => i.Amount));
    }

    [Fact]
    public void GenerateInstallments_MakesEveryInstallmentEqualExceptTheLast_WhichAbsorbsTheDrift()
    {
        // 999.99 / 13 = 76.9223… → 76.92 per row; the 3 cents that rounding drops
        // are all added to the final installment so the total stays exact.
        var debt = MakeDebt(999.99m, 0m, 13);

        var amounts = DebtCalculator.GenerateInstallments(debt).Select(i => i.Amount).ToList();

        Assert.All(amounts.Take(12), a => Assert.Equal(76.92m, a));
        Assert.Equal(76.95m, amounts[^1]);
        Assert.Equal(999.99m, amounts.Sum());
        // Drift is bounded: it can never exceed one cent per installment.
        Assert.True(amounts[^1] - amounts[0] < 0.01m * amounts.Count);
    }

    [Fact]
    public void GenerateInstallments_DuesInstallmentKExactlyKMonthsAfterTheAnchor()
    {
        var anchor = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        var debt = MakeDebt(1200m, 0m, 3);

        var schedule = DebtCalculator.GenerateInstallments(debt, anchorDate: anchor);

        Assert.Equal(new DateTime(2026, 2, 15), schedule[0].DueDate.Date);
        Assert.Equal(new DateTime(2026, 3, 15), schedule[1].DueDate.Date);
        Assert.Equal(new DateTime(2026, 4, 15), schedule[2].DueDate.Date);
    }

    [Fact]
    public void GenerateInstallments_AnchorsMidnightDuesAtNoon_SoNegativeUtcOffsetsDontShowThePreviousDay()
    {
        var anchor = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);

        var schedule = DebtCalculator.GenerateInstallments(MakeDebt(1200m, 0m, 3), anchorDate: anchor);

        Assert.All(schedule, i => Assert.Equal(new TimeSpan(12, 0, 0), i.DueDate.TimeOfDay));
    }

    [Fact]
    public void GenerateInstallments_ClampsMonthEndDates()
    {
        // Jan 31 + 1 month has no Feb 31; AddMonths clamps to the last valid day.
        var anchor = new DateTime(2026, 1, 31);

        var schedule = DebtCalculator.GenerateInstallments(MakeDebt(300m, 0m, 3), anchorDate: anchor);

        Assert.Equal(new DateTime(2026, 2, 28), schedule[0].DueDate.Date);
        Assert.Equal(new DateTime(2026, 3, 31), schedule[1].DueDate.Date);
    }

    [Fact]
    public void GenerateInstallments_WithoutAnchor_StartsOneMonthFromToday()
    {
        var schedule = DebtCalculator.GenerateInstallments(MakeDebt(1200m, 0m, 12));

        Assert.Equal(DateTime.UtcNow.Date.AddMonths(1), schedule[0].DueDate.Date);
    }

    [Fact]
    public void GenerateInstallments_PartialRegeneration_KeepsOriginalDueDatesAndNumbering()
    {
        // Installments 1-2 are already paid; regenerating 3-5 must not restart
        // the calendar at "today" — #3 is still due 3 months after the anchor.
        var anchor = new DateTime(2026, 1, 10);
        var debt = MakeDebt(500m, 0m, 5);

        var regenerated = DebtCalculator.GenerateInstallments(
            debt, startNumber: 3, count: 3, anchorDate: anchor, alreadyPaidTotal: 200m);

        Assert.Equal(new[] { 3, 4, 5 }, regenerated.Select(i => i.InstallmentNumber));
        Assert.Equal(new DateTime(2026, 4, 10), regenerated[0].DueDate.Date);
        Assert.Equal(new DateTime(2026, 6, 10), regenerated[2].DueDate.Date);
    }

    [Fact]
    public void GenerateInstallments_PartialRegeneration_OnlyChargesWhatIsStillOwed()
    {
        // 500 debt over 5, two 100 installments already paid → 300 left to schedule.
        var debt = MakeDebt(500m, 0m, 5);

        var regenerated = DebtCalculator.GenerateInstallments(
            debt, startNumber: 3, count: 3, alreadyPaidTotal: 200m);

        Assert.Equal(300m, regenerated.Sum(i => i.Amount));
    }

    [Fact]
    public void GenerateInstallments_PartialRegeneration_AbsorbsManuallyEditedPaidAmounts()
    {
        // User paid 8 + 8 + 8 on a 40/5 plan instead of 8 each of 5 → the two
        // remaining rows must still add up to the missing 16, not to 8 each.
        var debt = MakeDebt(40m, 0m, 5);

        var regenerated = DebtCalculator.GenerateInstallments(
            debt, startNumber: 4, count: 2, alreadyPaidTotal: 24m);

        Assert.Equal(16m, regenerated.Sum(i => i.Amount));
    }

    [Fact]
    public void GenerateInstallments_NeverProducesANegativeAmount()
    {
        // The user already overpaid more than the debt is worth.
        var debt = MakeDebt(100m, 0m, 4);

        var regenerated = DebtCalculator.GenerateInstallments(
            debt, startNumber: 4, count: 1, alreadyPaidTotal: 500m);

        Assert.All(regenerated, i => Assert.True(i.Amount >= 0, $"Negative installment: {i.Amount}"));
    }

    [Fact]
    public void GenerateInstallments_WithZeroCount_ReturnsEmptyWithoutThrowing()
    {
        var schedule = DebtCalculator.GenerateInstallments(MakeDebt(100m, 0m, 4), startNumber: 5, count: 0);

        Assert.Empty(schedule);
    }

    // ===================== RebalancePendingInstallments =====================

    private static Debt DebtWithSchedule(decimal balance, decimal rate, int installments)
    {
        var debt = MakeDebt(balance, rate, installments);
        debt.InstallmentsList = DebtCalculator.GenerateInstallments(debt, anchorDate: new DateTime(2026, 1, 1));
        for (int i = 0; i < debt.InstallmentsList.Count; i++)
            debt.InstallmentsList[i].Id = i + 1;
        return debt;
    }

    private static void Pay(Debt debt, int installmentNumber, decimal? amount = null)
    {
        var inst = debt.InstallmentsList.Single(i => i.InstallmentNumber == installmentNumber);
        if (amount.HasValue) inst.Amount = amount.Value;
        inst.IsPaid = true;
        inst.PaidDate = new DateTime(2026, 1, 5);
    }

    [Fact]
    public void Rebalance_PayingTheScheduledAmount_LeavesTheOtherInstallmentsUntouched()
    {
        var debt = DebtWithSchedule(1200m, 0m, 12);
        Pay(debt, 1);

        DebtCalculator.RebalancePendingInstallments(debt);

        Assert.All(debt.InstallmentsList.Where(i => !i.IsPaid), i => Assert.Equal(100m, i.Amount));
    }

    [Fact]
    public void Rebalance_Underpaying_SpreadsTheShortfallOverThePendingInstallments()
    {
        // Paid 50 instead of 100 on a 1200/12 plan → 1150 left over 11 rows.
        var debt = DebtWithSchedule(1200m, 0m, 12);
        Pay(debt, 1, 50m);

        DebtCalculator.RebalancePendingInstallments(debt);

        var pending = debt.InstallmentsList.Where(i => !i.IsPaid).ToList();
        Assert.Equal(11, pending.Count);
        Assert.Equal(1150m, pending.Sum(i => i.Amount));
        Assert.Equal(1200m, debt.InstallmentsList.Sum(i => i.Amount));
    }

    [Fact]
    public void Rebalance_Overpaying_ReducesTheRemainingInstallments()
    {
        // Paid 300 instead of 100 → only 900 left over the 11 pending rows.
        var debt = DebtWithSchedule(1200m, 0m, 12);
        Pay(debt, 1, 300m);

        DebtCalculator.RebalancePendingInstallments(debt);

        var pending = debt.InstallmentsList.Where(i => !i.IsPaid).ToList();
        Assert.Equal(900m, pending.Sum(i => i.Amount));
        Assert.All(pending, i => Assert.True(i.Amount < 100m));
    }

    [Fact]
    public void Rebalance_PayingMoreThanTheWholeDebt_ZeroesThePendingInstallmentsInsteadOfGoingNegative()
    {
        var debt = DebtWithSchedule(1200m, 0m, 12);
        Pay(debt, 1, 2000m);

        DebtCalculator.RebalancePendingInstallments(debt);

        Assert.All(debt.InstallmentsList.Where(i => !i.IsPaid), i => Assert.Equal(0m, i.Amount));
    }

    [Fact]
    public void Rebalance_KeepsTheScheduleSummingToTheExpectedTotal()
    {
        // 1000/7 doesn't divide evenly, so the remainder has to land somewhere exact.
        var debt = DebtWithSchedule(1000m, 0m, 7);
        Pay(debt, 1, 13.37m);

        DebtCalculator.RebalancePendingInstallments(debt);

        Assert.Equal(DebtCalculator.ExpectedTotal(debt), debt.InstallmentsList.Sum(i => i.Amount));
    }

    [Fact]
    public void Rebalance_WithInterest_TargetsTheAmortizedTotalNotThePrincipal()
    {
        var debt = DebtWithSchedule(1000m, 12m, 12);
        Pay(debt, 1, 50m);

        DebtCalculator.RebalancePendingInstallments(debt);

        Assert.Equal(1066.19m, debt.InstallmentsList.Sum(i => i.Amount));
    }

    [Fact]
    public void Rebalance_WhenEverythingIsPaid_DoesNothing()
    {
        var debt = DebtWithSchedule(1200m, 0m, 3);
        foreach (var i in debt.InstallmentsList) { i.IsPaid = true; i.Amount = 123m; }

        DebtCalculator.RebalancePendingInstallments(debt);

        Assert.All(debt.InstallmentsList, i => Assert.Equal(123m, i.Amount));
    }

    [Fact]
    public void Rebalance_OnTheLastPendingInstallment_MakesItSettleTheExactRemainder()
    {
        var debt = DebtWithSchedule(1000m, 0m, 3);
        Pay(debt, 1, 400m);
        Pay(debt, 2, 400m);

        DebtCalculator.RebalancePendingInstallments(debt);

        var last = debt.InstallmentsList.Single(i => !i.IsPaid);
        Assert.Equal(200m, last.Amount);
    }

    [Fact]
    public void Rebalance_IsIdempotent()
    {
        var debt = DebtWithSchedule(1000m, 0m, 7);
        Pay(debt, 1, 13.37m);

        DebtCalculator.RebalancePendingInstallments(debt);
        var afterFirst = debt.InstallmentsList.Select(i => i.Amount).ToList();
        DebtCalculator.RebalancePendingInstallments(debt);

        Assert.Equal(afterFirst, debt.InstallmentsList.Select(i => i.Amount));
    }
}
