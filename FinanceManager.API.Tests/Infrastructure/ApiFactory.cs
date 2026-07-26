using System.Runtime.CompilerServices;
using FinanceManager.API;
using FinanceManager.API.Data;
using FinanceManager.API.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;

namespace FinanceManager.API.Tests.Infrastructure;

/// <summary>
/// Boots the real API — real routing, real JWT validation, real controllers — against
/// SQLite in-memory instead of Postgres.
///
/// The point is to exercise the actual authorization pipeline. A stubbed auth handler
/// would bypass precisely the code these tests exist to protect.
/// </summary>
public class ApiFactory : WebApplicationFactory<ApiMarker>
{
    // A ":memory:" database lives exactly as long as its connection, so one is held
    // open here for the factory's lifetime. Every context resolved from DI shares it.
    private readonly SqliteConnection _connection = new("DataSource=:memory:");

    // HMAC-SHA512 signing needs >= 64 bytes; Program.cs fails fast below that.
    private const string TestTokenKey =
        "integration-test-signing-key-not-a-secret-0123456789-abcdefghijklmnopqrstuvwxyz";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Program.cs keys its test-host behaviour off this: it skips Postgres discovery,
        // skips the Npgsql migrations, and leaves AppDbContext unregistered for us.
        builder.UseEnvironment("Testing");

        // UseSetting, not ConfigureAppConfiguration: with top-level statements the
        // WebApplicationBuilder reads its configuration while Program.cs is still
        // executing, which is before ConfigureAppConfiguration callbacks are applied.
        // These land in host configuration early enough for Program.cs to see them.
        builder.UseSetting("TokenKey", TestTokenKey);

        // Must match TokenService's defaults or every token fails validation.
        builder.UseSetting("Jwt:Issuer", "finanzasbr.com");
        builder.UseSetting("Jwt:Audience", "finanzasbr-app");

        // The whole matrix drives every endpoint from one IP; the production 100/min
        // would trip partway through and turn real failures into confusing 429s.
        builder.UseSetting("RateLimiting:GlobalPermitLimit", "100000");

        builder.ConfigureTestServices(services =>
        {
            _connection.Open();
            services.AddDbContext<AppDbContext>(options => options.UseSqlite(_connection));

            // Keep the suite offline. Both of these are HttpClient-backed in production.
            services.RemoveAll<IEmailService>();
            services.AddScoped<IEmailService, NoOpEmailService>();

            services.RemoveAll<IAiService>();
            services.AddScoped<IAiService, StubAiService>();
        });
    }

    // EnsureCreated rather than Migrate: the migrations are Npgsql-specific and cannot
    // run on SQLite. This builds the schema straight from the model instead.
    protected override IHost CreateHost(IHostBuilder builder)
    {
        var host = base.CreateHost(builder);

        using var scope = host.Services.CreateScope();
        scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();

        return host;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _connection.Dispose();
        }
    }

    private sealed class NoOpEmailService : IEmailService
    {
        public Task SendEmailAsync(string toEmail, string subject, string body) => Task.CompletedTask;
    }

    private sealed class StubAiService : IAiService
    {
        public async IAsyncEnumerable<string> StreamReplyAsync(
            AiChatContext context,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            await Task.CompletedTask;
            yield return "stubbed";
        }
    }
}
