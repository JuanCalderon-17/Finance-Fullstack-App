using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using FinanceManager.API.Data;
using FinanceManager.API.Tests.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceManager.API.Tests;

/// <summary>
/// Deleting an account has to take the user's data with it. Every user-owned table
/// cascades from AppUser, and SavingsAccounts was the one that did not — its FK was
/// created without ON DELETE CASCADE, so Postgres refused the delete and the user got
/// a 500. Anyone who had ever created a savings account was stuck.
///
/// These run on SQLite, which EF configures with foreign keys enforced, and the schema
/// comes from the model rather than the migrations. So they verify the relationship is
/// configured correctly — they do not verify the migration that carries that change to
/// production. That still needs applying against Postgres.
/// </summary>
public class AccountDeletionTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Password = "Str0ng-Passw0rd!";

    private readonly ApiFactory _factory;
    private TestUser _user = null!;

    public AccountDeletionTests(ApiFactory factory) => _factory = factory;

    public async Task InitializeAsync() =>
        _user = await _factory.CreateAsync($"deleting-{Guid.NewGuid():N}@example.com");

    public Task DisposeAsync() => Task.CompletedTask;

    [Fact]
    public async Task AnAccountHoldingEveryKindOfRecord_CanStillBeDeleted()
    {
        await SeedOneOfEverything();

        var response = await DeleteAccount(Password);

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
    }

    [Fact]
    public async Task DeletingAnAccount_TakesItsSavingsWithIt()
    {
        // The specific regression: savings used to be left behind, and the orphaned rows
        // were what made Postgres reject the delete.
        await SeedOneOfEverything();

        (await DeleteAccount(Password)).EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Assert.Empty(await db.SavingsAccounts.Where(s => s.AppUserId == _user.Id).ToListAsync());
    }

    [Fact]
    public async Task DeletingAnAccount_LeavesNoDataBehindInAnyTable()
    {
        await SeedOneOfEverything();

        (await DeleteAccount(Password)).EnsureSuccessStatusCode();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Assert.Empty(await db.SavingsAccounts.Where(s => s.AppUserId == _user.Id).ToListAsync());
        Assert.Empty(await db.Transactions.Where(t => t.AppUserId == _user.Id).ToListAsync());
        Assert.Empty(await db.Debts.Where(d => d.AppUserId == _user.Id).ToListAsync());
        Assert.Empty(await db.RecurringTransactions.Where(r => r.AppUserId == _user.Id).ToListAsync());
        Assert.Empty(await db.Users.Where(u => u.Id == _user.Id).ToListAsync());
    }

    [Fact]
    public async Task DeletingAnAccount_RequiresTheCorrectPassword()
    {
        // Deletion is irreversible and the endpoint takes a password for that reason.
        // Worth pinning alongside the cascade so a future refactor can't drop the check.
        await SeedOneOfEverything();

        var response = await DeleteAccount("not-the-right-password");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        Assert.NotEmpty(await db.SavingsAccounts.Where(s => s.AppUserId == _user.Id).ToListAsync());
    }

    [Fact]
    public async Task CreatingSavings_WithoutAUserIdClaim_IsRefused()
    {
        // A row with a null owner is invisible to every "where AppUserId == userId" query
        // and cannot be removed through the API. Refusing is cheaper than orphan cleanup.
        var anonymous = _factory.CreateClient();

        var response = await anonymous.PostAsJsonAsync("/api/savings", new
        {
            name = "orphan",
            balance = 1m,
            color = "#000",
            icon = "bi-bank"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ===================== helpers =====================

    private Task<HttpResponseMessage> DeleteAccount(string password)
    {
        // DELETE with a body, so HttpClient.DeleteAsync won't do.
        var request = new HttpRequestMessage(HttpMethod.Delete, "/api/account")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(new { password }), Encoding.UTF8, "application/json")
        };

        return _user.Client.SendAsync(request);
    }

    private async Task SeedOneOfEverything()
    {
        (await _user.Client.PostAsJsonAsync("/api/savings", new
        {
            name = "emergency fund",
            balance = 2500m,
            goal = 10000m,
            color = "#abcdef",
            icon = "bi-bank"
        })).EnsureSuccessStatusCode();

        (await _user.Client.PostAsJsonAsync("/api/transactions", new
        {
            description = "salary",
            amount = 3000m,
            transactionDate = DateTime.UtcNow,
            category = "Salary",
            currency = "USD"
        })).EnsureSuccessStatusCode();

        (await _user.Client.PostAsJsonAsync("/api/debts", new
        {
            name = "car loan",
            originalBalance = 1200m,
            interestRate = 0m,
            installments = 12,
            color = "#123456",
            icon = "bi-credit-card"
        })).EnsureSuccessStatusCode();

        (await _user.Client.PostAsJsonAsync("/api/recurring", new
        {
            description = "rent",
            amount = 900m,
            category = "Housing",
            currency = "USD",
            frequency = 2,
            startDate = DateTime.UtcNow.Date
        })).EnsureSuccessStatusCode();
    }
}
