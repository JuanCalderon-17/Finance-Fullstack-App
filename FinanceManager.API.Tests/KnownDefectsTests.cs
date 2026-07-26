using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceManager.API.Data;
using FinanceManager.API.Models;
using FinanceManager.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceManager.API.Tests;

/// <summary>
/// Defects found while building out the test suite, pinned rather than fixed.
///
/// Every test here asserts what the code does TODAY, not what it should do. Each one
/// documents the correct behaviour in a comment. That keeps the suite honest — the bug
/// is recorded and cannot be forgotten — and when someone fixes it the corresponding
/// test goes red, which is the signal to delete the pin and write the real assertion.
///
/// Ordered roughly by user-facing impact.
/// </summary>
public class KnownDefectsTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly ApiFactory _factory;
    private TestUser _user = null!;

    public KnownDefectsTests(ApiFactory factory) => _factory = factory;

    public async Task InitializeAsync() =>
        _user = await _factory.CreateAsync($"defects-{Guid.NewGuid():N}@example.com");

    public Task DisposeAsync() => Task.CompletedTask;

    // ===================== 1. recurring month-end drift =====================

    [Fact]
    public void KnownBug_MonthlyRecurrence_PermanentlyDriftsAfterAShortMonth()
    {
        // SHOULD BE: a rule anchored on the 31st bills on the 31st of every month that
        // has one, i.e. StartDate + k months, the way DebtsController.GenerateInstallments
        // computes its schedule from a fixed anchor.
        //
        // ACTUALLY IS: Advance walks from the PREVIOUS due date, so one short month
        // ratchets the day-of-month down permanently. A rent rule set to the 31st
        // silently becomes the 28th forever after passing February.
        var jan31 = new DateTime(2027, 1, 31, 12, 0, 0, DateTimeKind.Utc);

        var feb = RecurringTransaction.Advance(jan31, RecurrenceFrequency.Monthly);
        var mar = RecurringTransaction.Advance(feb, RecurrenceFrequency.Monthly);
        var apr = RecurringTransaction.Advance(mar, RecurrenceFrequency.Monthly);

        Assert.Equal(28, feb.Day); // correct — February has no 31st
        Assert.Equal(28, mar.Day); // WRONG — should be 31
        Assert.Equal(28, apr.Day); // WRONG — should be 30, and it never recovers
    }

    [Fact]
    public void KnownBug_YearlyRecurrence_LosesTheLeapDayForever()
    {
        // SHOULD BE: Feb 29 rules land on Feb 29 again at the next leap year.
        // ACTUALLY IS: the first non-leap year pins it to the 28th permanently.
        var leapDay = new DateTime(2028, 2, 29, 12, 0, 0, DateTimeKind.Utc);

        var next = RecurringTransaction.Advance(leapDay, RecurrenceFrequency.Yearly);
        var thenAcrossTheNextLeapYear = next;
        for (var i = 0; i < 3; i++)
        {
            thenAcrossTheNextLeapYear =
                RecurringTransaction.Advance(thenAcrossTheNextLeapYear, RecurrenceFrequency.Yearly);
        }

        Assert.Equal(28, next.Day);                          // correct — 2029 has no Feb 29
        Assert.Equal(2032, thenAcrossTheNextLeapYear.Year);  // a leap year again
        Assert.Equal(28, thenAcrossTheNextLeapYear.Day);     // WRONG — should be back to 29
    }

    // ===================== 2. editing a transaction drops its currency =====================

    [Fact]
    public async Task KnownBug_EditingATransaction_SilentlyDiscardsACurrencyChange()
    {
        // SHOULD BE: PUT applies the submitted currency, or rejects the request.
        // ACTUALLY IS: PutTransaction copies Description/Amount/TransactionDate/Category
        // and nothing else. The edit returns 204 and the currency is quietly unchanged —
        // so a transaction entered in the wrong currency cannot be corrected, and the
        // dashboard keeps converting it at the wrong rate.
        var created = await _user.Client.PostAsJsonAsync("/api/transactions", new
        {
            description = "flight",
            amount = 500m,
            transactionDate = DateTime.UtcNow,
            category = "Travel",
            currency = "USD"
        });
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var edit = await _user.Client.PutAsJsonAsync($"/api/transactions/{id}", new
        {
            id,
            description = "flight",
            amount = 500m,
            transactionDate = DateTime.UtcNow,
            category = "Travel",
            currency = "BRL", // the user is correcting the currency
            appUserId = _user.Id
        });

        Assert.Equal(HttpStatusCode.NoContent, edit.StatusCode); // accepted...

        var after = await _user.Client.GetFromJsonAsync<JsonElement>($"/api/transactions/{id}");
        Assert.Equal("USD", after.GetProperty("currency").GetString()); // ...and ignored
    }

    // ===================== 3. a savings goal cannot be removed =====================

    [Fact]
    public async Task KnownBug_ASavingsGoal_CanNeverBeCleared()
    {
        // SHOULD BE: some request shape clears the goal.
        // ACTUALLY IS: UpdateSaving only writes Goal when dto.Goal.HasValue, which was a
        // deliberate fix so an update that omits the goal can't wipe it — but it left no
        // way to remove one. Omitting keeps it, and sending null keeps it too. The only
        // escape is deleting and recreating the account.
        var created = await _user.Client.PostAsJsonAsync("/api/savings", new
        {
            name = "house fund",
            balance = 1000m,
            goal = 50000m,
            color = "#abcdef",
            icon = "bi-bank"
        });
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        var clear = await _user.Client.PutAsJsonAsync($"/api/savings/{id}", new
        {
            name = "house fund",
            balance = 1000m,
            goal = (decimal?)null, // explicitly asking for no goal
            color = "#abcdef",
            icon = "bi-bank"
        });
        Assert.Equal(HttpStatusCode.NoContent, clear.StatusCode);

        var all = await _user.Client.GetFromJsonAsync<JsonElement>("/api/savings");
        var account = all.EnumerateArray().Single(a => a.GetProperty("id").GetInt32() == id);

        Assert.Equal(50000m, account.GetProperty("goal").GetDecimal()); // still there
    }

    // ===================== 4. the AI assistant is told nothing was paid =====================

    [Fact]
    public async Task KnownBug_PaidInstallmentsColumn_IsNeverWritten()
    {
        // SHOULD BE: Debt.PaidInstallments tracks how many installments are settled.
        // ACTUALLY IS: nothing in the API ever assigns it. The debts UI is unaffected
        // because MapToDto recomputes the value from the installment list — but
        // FinanceContextBuilder reads the stored column, so the AI assistant is always
        // told the user has paid 0 installments no matter how much they have repaid.
        var created = await _user.Client.PostAsJsonAsync("/api/debts", new
        {
            name = "car loan",
            originalBalance = 1200m,
            interestRate = 0m,
            installments = 12,
            color = "#123456",
            icon = "bi-credit-card"
        });
        created.EnsureSuccessStatusCode();

        var debt = await created.Content.ReadFromJsonAsync<JsonElement>();
        var debtId = debt.GetProperty("id").GetInt32();
        var firstInstallment = debt.GetProperty("installmentsList").EnumerateArray().First()
            .GetProperty("id").GetInt32();

        var paid = await _user.Client.PutAsync(
            $"/api/debts/{debtId}/installments/{firstInstallment}/toggle", null);
        paid.EnsureSuccessStatusCode();

        // The DTO looks right, which is why this has gone unnoticed.
        var afterDto = await _user.Client.GetFromJsonAsync<JsonElement>($"/api/debts/{debtId}");
        Assert.Equal(1, afterDto.GetProperty("paidInstallments").GetInt32());

        // The stored column — what the assistant actually reads — did not move.
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.Debts.AsNoTracking().SingleAsync(d => d.Id == debtId);

        Assert.Equal(0, stored.PaidInstallments);
    }

    // ===================== 5. recurring rules can be confirmed out of turn =====================

    [Fact]
    public async Task KnownBug_AFutureDatedRecurringRule_CanBeConfirmedEarly()
    {
        // SHOULD BE: Confirm refuses a rule that is not due yet (and one that is inactive).
        // ACTUALLY IS: Confirm looks the rule up by id and owner only. It will happily post
        // a transaction dated in the future and advance the schedule past it, so the
        // occurrence the user actually owes silently disappears from the due list.
        var startsNextYear = DateTime.UtcNow.Date.AddYears(1);

        var created = await _user.Client.PostAsJsonAsync("/api/recurring", new
        {
            description = "next year's insurance",
            amount = 300m,
            category = "Insurance",
            currency = "USD",
            frequency = 2, // Monthly
            startDate = startsNextYear
        });
        created.EnsureSuccessStatusCode();
        var id = (await created.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();

        // Not due — it is a year out.
        var due = await _user.Client.GetFromJsonAsync<JsonElement>("/api/recurring/due");
        Assert.DoesNotContain(due.EnumerateArray(),
            d => d.GetProperty("recurringId").GetInt32() == id);

        var confirm = await _user.Client.PostAsync($"/api/recurring/{id}/confirm", null);

        Assert.Equal(HttpStatusCode.OK, confirm.StatusCode); // accepted anyway

        var posted = await confirm.Content.ReadFromJsonAsync<JsonElement>();
        Assert.True(posted.GetProperty("transactionDate").GetDateTime() > DateTime.UtcNow);
    }

    // ===================== 6. installment due dates skip UTC normalisation =====================

    [Fact]
    public async Task KnownBug_EditingAnInstallmentDueDate_SkipsTheNoonAnchor()
    {
        // SHOULD BE: the date goes through the same normalisation as every other date the
        // API stores — anchored to 12:00 UTC so that browsers behind UTC don't render it
        // as the previous day.
        //
        // ACTUALLY IS: UpdateInstallment assigns dto.DueDate straight through. Here that
        // shows up as a midnight timestamp; against Postgres a date-only body (Kind =
        // Unspecified) additionally makes Npgsql reject the write on a timestamptz column
        // and surface as a 500. This harness runs SQLite, so only the anchor loss is
        // observable — the 500 needs verifying against Postgres.
        var created = await _user.Client.PostAsJsonAsync("/api/debts", new
        {
            name = "laptop",
            originalBalance = 900m,
            interestRate = 0m,
            installments = 3,
            color = "#000000",
            icon = "bi-laptop"
        });
        created.EnsureSuccessStatusCode();

        var debt = await created.Content.ReadFromJsonAsync<JsonElement>();
        var debtId = debt.GetProperty("id").GetInt32();
        var installments = debt.GetProperty("installmentsList").EnumerateArray().ToList();

        // Everything the generator produces is anchored at noon.
        Assert.All(installments, i =>
            Assert.Equal(12, i.GetProperty("dueDate").GetDateTime().Hour));

        var target = installments.First().GetProperty("id").GetInt32();
        var edit = await _user.Client.PutAsJsonAsync($"/api/debts/{debtId}/installments/{target}", new
        {
            dueDate = new DateTime(2027, 3, 1, 0, 0, 0, DateTimeKind.Utc)
        });
        edit.EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var stored = await db.Installments.AsNoTracking().SingleAsync(i => i.Id == target);

        Assert.Equal(0, stored.DueDate.Hour); // WRONG — the anchor is gone
    }

    // The savings cascade defect that used to be pinned here is fixed: see
    // AccountDeletionTests, which covers deletion end to end.
}
