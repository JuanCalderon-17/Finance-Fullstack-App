using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FinanceManager.API.Tests.Infrastructure;

namespace FinanceManager.API.Tests.Security;

/// <summary>
/// The app is one deployment shared by a family. Every table is partitioned only by
/// AppUserId, so a single dropped filter would let one relative read another's finances.
///
/// These tests seed Alice with one of every entity, then drive the whole API as Bob and
/// assert he can neither read nor mutate any of it. They are written against the real
/// HTTP pipeline — real routing, real JWT validation, real controllers — because that is
/// where the ownership checks actually live.
/// </summary>
public class CrossUserIsolationTests : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private readonly ApiFactory _factory;

    // Alice's rows are tagged with this, so "did the response leak her data" is a
    // substring check rather than a guess about response shape.
    private readonly string _aliceMarker = $"ALICE-SECRET-{Guid.NewGuid():N}";

    private TestUser _alice = null!;
    private TestUser _bob = null!;
    private HttpClient _anonymous = null!;

    private int _transactionId;
    private int _debtId;
    private int _installmentId;
    private int _savingsId;
    private int _recurringId;

    public CrossUserIsolationTests(ApiFactory factory) => _factory = factory;

    public async Task InitializeAsync()
    {
        _alice = await _factory.CreateAsync($"alice-{Guid.NewGuid():N}@example.com");
        _bob = await _factory.CreateAsync($"bob-{Guid.NewGuid():N}@example.com");
        _anonymous = _factory.CreateClient();

        // Seeded through the real endpoints, so the create paths are covered too.
        _transactionId = await SeedTransaction();
        (_debtId, _installmentId) = await SeedDebt();
        _savingsId = await SeedSavings();
        _recurringId = await SeedRecurring();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    // ===================== the matrix =====================

    /// <summary>
    /// Route template, HTTP method, and the status the controller actually produces.
    ///
    /// The expected status is NOT uniform, and that is deliberate: Transactions loads the
    /// row first and then compares owners (403), while Debts/Savings/Recurring fold the
    /// owner into the query (404). Both refuse the request; they differ in what they admit
    /// about the row's existence. See TransactionsLeaksExistenceOfOtherUsersRows below.
    /// </summary>
    public static TheoryData<string, string, HttpStatusCode> OtherUsersRoutes => new()
    {
        { "GET",    "/api/transactions/{transaction}",                        HttpStatusCode.Forbidden },
        { "PUT",    "/api/transactions/{transaction}",                        HttpStatusCode.Forbidden },
        { "DELETE", "/api/transactions/{transaction}",                        HttpStatusCode.Forbidden },

        { "GET",    "/api/debts/{debt}",                                      HttpStatusCode.NotFound },
        { "PUT",    "/api/debts/{debt}",                                      HttpStatusCode.NotFound },
        { "DELETE", "/api/debts/{debt}",                                      HttpStatusCode.NotFound },
        { "PUT",    "/api/debts/{debt}/installments/{installment}",           HttpStatusCode.NotFound },
        { "PUT",    "/api/debts/{debt}/installments/{installment}/toggle",    HttpStatusCode.NotFound },

        { "PUT",    "/api/savings/{savings}",                                 HttpStatusCode.NotFound },
        { "DELETE", "/api/savings/{savings}",                                 HttpStatusCode.NotFound },

        { "PUT",    "/api/recurring/{recurring}",                             HttpStatusCode.NotFound },
        { "DELETE", "/api/recurring/{recurring}",                             HttpStatusCode.NotFound },
        { "POST",   "/api/recurring/{recurring}/confirm",                     HttpStatusCode.NotFound },
        { "POST",   "/api/recurring/{recurring}/skip",                        HttpStatusCode.NotFound }
    };

    [Theory]
    [MemberData(nameof(OtherUsersRoutes))]
    public async Task AnotherUsersRow_IsRefused_AndNeverLeaksItsContents(
        string method, string routeTemplate, HttpStatusCode expected)
    {
        var response = await Send(_bob.Client, method, Resolve(routeTemplate));

        Assert.Equal(expected, response.StatusCode);

        // The status alone is not enough — a handler could refuse and still echo the row.
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain(_aliceMarker, body);
    }

    [Theory]
    [MemberData(nameof(OtherUsersRoutes))]
    public async Task EveryProtectedRoute_RejectsAnonymousCallers(
        string method, string routeTemplate, HttpStatusCode _)
    {
        var response = await Send(_anonymous, method, Resolve(routeTemplate));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ===================== collections =====================

    [Theory]
    [InlineData("/api/transactions")]
    [InlineData("/api/debts")]
    [InlineData("/api/savings")]
    [InlineData("/api/recurring")]
    [InlineData("/api/recurring/due")]
    public async Task Collections_ReturnNothingBelongingToAnotherUser(string route)
    {
        var response = await _bob.Client.GetAsync(route);
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadAsStringAsync();

        Assert.DoesNotContain(_aliceMarker, body);
        Assert.Empty(JsonDocument.Parse(body).RootElement.EnumerateArray());
    }

    [Theory]
    [InlineData("/api/transactions")]
    [InlineData("/api/debts")]
    [InlineData("/api/savings")]
    [InlineData("/api/recurring")]
    [InlineData("/api/recurring/due")]
    public async Task Collections_RejectAnonymousCallers(string route)
    {
        var response = await _anonymous.GetAsync(route);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Owner_StillSeesTheirOwnData()
    {
        // The counterweight to everything above: proves the refusals come from ownership
        // checks and not from the seeding silently having failed.
        var response = await _alice.Client.GetAsync("/api/transactions");
        response.EnsureSuccessStatusCode();

        Assert.Contains(_aliceMarker, await response.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task ChatInsights_RejectsAnonymousCallers()
    {
        var response = await _anonymous.GetAsync("/api/chat/insights");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    // ===================== documented weakness =====================

    [Fact]
    public async Task TransactionsLeaksExistenceOfOtherUsersRows()
    {
        // KNOWN GAP (pinned, not fixed): TransactionsController answers 403 for a row that
        // exists but belongs to someone else, and 404 for one that does not exist. Bob
        // cannot read Alice's transaction, but he can learn that it exists by probing ids.
        // Debts/Savings/Recurring avoid this by folding the owner into the lookup.
        var existsButNotHis = await _bob.Client.GetAsync($"/api/transactions/{_transactionId}");
        var doesNotExist = await _bob.Client.GetAsync("/api/transactions/999999");

        Assert.Equal(HttpStatusCode.Forbidden, existsButNotHis.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, doesNotExist.StatusCode);
    }

    // ===================== helpers =====================

    private string Resolve(string routeTemplate) => routeTemplate
        .Replace("{transaction}", _transactionId.ToString())
        .Replace("{debt}", _debtId.ToString())
        .Replace("{installment}", _installmentId.ToString())
        .Replace("{savings}", _savingsId.ToString())
        .Replace("{recurring}", _recurringId.ToString());

    /// <summary>
    /// PUTs need a body that survives model validation, otherwise the request 400s before
    /// it ever reaches the ownership check and the test proves nothing.
    /// </summary>
    private Task<HttpResponseMessage> Send(HttpClient client, string method, string route) => method switch
    {
        "GET" => client.GetAsync(route),
        "DELETE" => client.DeleteAsync(route),
        "POST" => client.PostAsync(route, null),
        "PUT" when route.Contains("/transactions/") => client.PutAsJsonAsync(route, new
        {
            id = _transactionId,
            description = "bob-overwrite",
            amount = 1m,
            transactionDate = DateTime.UtcNow,
            category = "Other",
            currency = "USD",
            // Bob claiming ownership is the realistic attack, and it clears [Required].
            appUserId = _bob.Id
        }),
        "PUT" when route.Contains("/installments/") => client.PutAsJsonAsync(route, new
        {
            amount = 1m,
            isPaid = true
        }),
        "PUT" when route.Contains("/debts/") => client.PutAsJsonAsync(route, new
        {
            name = "bob-overwrite",
            originalBalance = 100m,
            interestRate = 0m,
            installments = 2,
            color = "#000",
            icon = "bi-credit-card"
        }),
        "PUT" when route.Contains("/savings/") => client.PutAsJsonAsync(route, new
        {
            name = "bob-overwrite",
            balance = 1m,
            color = "#000",
            icon = "bi-bank"
        }),
        "PUT" when route.Contains("/recurring/") => client.PutAsJsonAsync(route, new
        {
            description = "bob-overwrite",
            amount = 1m,
            category = "Other",
            currency = "USD",
            frequency = 2,
            startDate = DateTime.UtcNow,
            isActive = true
        }),
        _ => throw new InvalidOperationException($"No body defined for {method} {route}")
    };

    private async Task<int> SeedTransaction()
    {
        var response = await _alice.Client.PostAsJsonAsync("/api/transactions", new
        {
            description = _aliceMarker,
            amount = 1234.56m,
            transactionDate = DateTime.UtcNow,
            category = "Salary",
            currency = "USD"
        });
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<(int DebtId, int InstallmentId)> SeedDebt()
    {
        var response = await _alice.Client.PostAsJsonAsync("/api/debts", new
        {
            name = _aliceMarker,
            originalBalance = 1200m,
            interestRate = 0m,
            installments = 12,
            color = "#123456",
            icon = "bi-credit-card"
        });
        response.EnsureSuccessStatusCode();

        var debt = await response.Content.ReadFromJsonAsync<JsonElement>();
        var installment = debt.GetProperty("installmentsList").EnumerateArray().First();

        return (debt.GetProperty("id").GetInt32(), installment.GetProperty("id").GetInt32());
    }

    private async Task<int> SeedSavings()
    {
        var response = await _alice.Client.PostAsJsonAsync("/api/savings", new
        {
            name = _aliceMarker,
            balance = 5000m,
            goal = 10000m,
            color = "#abcdef",
            icon = "bi-bank"
        });
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }

    private async Task<int> SeedRecurring()
    {
        var response = await _alice.Client.PostAsJsonAsync("/api/recurring", new
        {
            description = _aliceMarker,
            amount = 99.99m,
            category = "Rent",
            currency = "USD",
            frequency = 2, // Monthly
            startDate = DateTime.UtcNow.Date.AddDays(-1)
        });
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<JsonElement>()).GetProperty("id").GetInt32();
    }
}
