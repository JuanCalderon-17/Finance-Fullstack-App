using System.Net.Http.Headers;
using FinanceManager.API.Interfaces;
using FinanceManager.API.Models;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace FinanceManager.API.Tests.Infrastructure;

/// <summary>A seeded user plus an HttpClient already carrying that user's bearer token.</summary>
public sealed record TestUser(string Id, string Email, HttpClient Client);

public static class TestUsers
{
    /// <summary>
    /// Creates a real Identity user and signs a real JWT for them with the app's own
    /// TokenService, so requests go through the genuine JwtBearer validation path —
    /// signing key, issuer, audience, and the NameIdentifier claim that every
    /// ownership filter in the API reads.
    /// </summary>
    public static async Task<TestUser> CreateAsync(this ApiFactory factory, string email)
    {
        using var scope = factory.Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        var tokens = scope.ServiceProvider.GetRequiredService<ITokenService>();

        var user = new AppUser
        {
            UserName = email,
            Email = email,
            FullName = email.Split('@')[0],
            EmailConfirmed = true,
            IsEmailVerified = true
        };

        var created = await users.CreateAsync(user, "Str0ng-Passw0rd!");
        if (!created.Succeeded)
        {
            var errors = string.Join("; ", created.Errors.Select(e => e.Description));
            throw new InvalidOperationException($"Could not seed test user {email}: {errors}");
        }

        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", tokens.CreateToken(user));

        return new TestUser(user.Id, email, client);
    }
}
