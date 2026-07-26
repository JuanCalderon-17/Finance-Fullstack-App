using System.Reflection;
using FinanceManager.API;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace FinanceManager.API.Tests.Security;

/// <summary>
/// A route matrix only covers what somebody remembered to add to it. These tests close
/// that gap: they enumerate the API's real endpoints by reflection and fail when one
/// appears that nobody has classified.
///
/// So adding an endpoint that reads user data and forgetting to test its ownership check
/// does not quietly ship — it turns this suite red until the author either covers it in
/// CrossUserIsolationTests or states, in writing, that it is public on purpose.
/// </summary>
public class EndpointCoverageTests
{
    /// <summary>Controllers serving data partitioned by AppUserId. Every action must be authorized.</summary>
    private static readonly string[] UserDataControllers =
    [
        "TransactionsController",
        "DebtsController",
        "SavingsController",
        "RecurringController",
        "ChatController"
    ];

    /// <summary>
    /// Endpoints reachable without a token, each one deliberately so. Anything not in
    /// this set and not authorized is a bug.
    /// </summary>
    private static readonly HashSet<string> AnonymousByDesign =
    [
        // The auth flows themselves — a user has no token yet.
        "AccountController.Register",
        "AccountController.Login",
        "AccountController.ForgotPassword",
        "AccountController.VerifyEmail",
        "AccountController.ResendVerification",
        "AccountController.ResetPassword",

        // Public FX rates, no user data involved. Rate-limited separately.
        "CurrencyController.GetExchangeRate",
        "CurrencyController.GetAllRates",
        "CurrencyController.Test"
    ];

    /// <summary>
    /// Authorized endpoints and how their ownership behaviour is covered. An entry here
    /// is a claim that the endpoint cannot serve another user's data.
    /// </summary>
    private static readonly HashSet<string> CoveredByIsolationSuite =
    [
        // Per-row routes driven as the wrong user in CrossUserIsolationTests.
        "TransactionsController.GetTransaction",
        "TransactionsController.PutTransaction",
        "TransactionsController.DeleteTransaction",
        "DebtsController.GetDebt",
        "DebtsController.UpdateDebt",
        "DebtsController.DeleteDebt",
        "DebtsController.UpdateInstallment",
        "DebtsController.ToggleInstallmentPaid",
        "SavingsController.UpdateSaving",
        "SavingsController.DeleteSaving",
        "RecurringController.Update",
        "RecurringController.Delete",
        "RecurringController.Confirm",
        "RecurringController.Skip",

        // Collection routes asserted to return nothing belonging to another user.
        "TransactionsController.GetTransactions",
        "DebtsController.GetDebts",
        "SavingsController.GetMySavings",
        "RecurringController.GetAll",
        "RecurringController.GetDue",

        // Create routes: scoped to the caller's own id, no cross-user surface. Exercised
        // as the seeding path of every isolation test.
        "TransactionsController.PostTransaction",
        "DebtsController.CreateDebt",
        "SavingsController.CreateSaving",
        "RecurringController.Create",

        // Act on the caller's own account only; asserted to reject anonymous callers.
        "ChatController.StreamChat",
        "ChatController.GetInsights",
        "AccountController.UpdateProfile",
        "AccountController.ChangePassword",
        "AccountController.DeleteAccount"
    ];

    [Fact]
    public void EveryEndpoint_IsEitherAuthorized_OrDeliberatelyAnonymous()
    {
        var unclassified = AllActions()
            .Where(a => !IsAuthorized(a) && !AnonymousByDesign.Contains(Name(a)))
            .Select(Name)
            .ToList();

        Assert.True(unclassified.Count == 0,
            "These endpoints are reachable without authentication and are not listed as " +
            "anonymous by design. Add [Authorize], or add them to AnonymousByDesign with a " +
            "reason:\n  " + string.Join("\n  ", unclassified));
    }

    [Fact]
    public void EveryAuthorizedEndpoint_IsCoveredByTheIsolationSuite()
    {
        var uncovered = AllActions()
            .Where(IsAuthorized)
            .Select(Name)
            .Where(name => !CoveredByIsolationSuite.Contains(name))
            .ToList();

        Assert.True(uncovered.Count == 0,
            "These authorized endpoints have no cross-user isolation coverage. Add them to " +
            "CrossUserIsolationTests, then list them in CoveredByIsolationSuite:\n  " +
            string.Join("\n  ", uncovered));
    }

    [Fact]
    public void ControllersServingUserData_AreAuthorizedAtClassLevel()
    {
        // Class-level [Authorize] is the backstop: it means a newly added action is
        // protected by default, rather than open until someone remembers the attribute.
        var unprotected = AllControllers()
            .Where(c => UserDataControllers.Contains(c.Name))
            .Where(c => c.GetCustomAttribute<AuthorizeAttribute>() is null)
            .Select(c => c.Name)
            .ToList();

        Assert.True(unprotected.Count == 0,
            "These controllers serve AppUserId-partitioned data but have no class-level " +
            "[Authorize]:\n  " + string.Join("\n  ", unprotected));
    }

    [Fact]
    public void ControllersServingUserData_HaveNoAnonymousActions()
    {
        var escaped = AllActions()
            .Where(a => UserDataControllers.Contains(a.DeclaringType!.Name))
            .Where(a => a.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
            .Select(Name)
            .ToList();

        Assert.True(escaped.Count == 0,
            "[AllowAnonymous] on an endpoint serving user-owned data:\n  " +
            string.Join("\n  ", escaped));
    }

    [Fact]
    public void TheReflectionActuallyFindsEndpoints()
    {
        // Guards the guards: if the discovery below silently matched nothing, every test
        // in this file would pass vacuously.
        Assert.True(AllControllers().Count() >= 6);
        Assert.True(AllActions().Count() >= 25);
    }

    // ===================== discovery =====================

    private static IEnumerable<Type> AllControllers() => typeof(ApiMarker).Assembly
        .GetTypes()
        .Where(t => t is { IsAbstract: false, IsPublic: true } && typeof(ControllerBase).IsAssignableFrom(t));

    private static IEnumerable<MethodInfo> AllActions() => AllControllers()
        .SelectMany(c => c.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.DeclaredOnly))
        .Where(m => !m.IsSpecialName && m.GetCustomAttribute<NonActionAttribute>() is null);

    private static bool IsAuthorized(MethodInfo action)
    {
        if (action.GetCustomAttribute<AllowAnonymousAttribute>() is not null)
        {
            return false;
        }

        return action.GetCustomAttribute<AuthorizeAttribute>() is not null
            || action.DeclaringType!.GetCustomAttribute<AuthorizeAttribute>() is not null;
    }

    private static string Name(MethodInfo action) => $"{action.DeclaringType!.Name}.{action.Name}";
}
