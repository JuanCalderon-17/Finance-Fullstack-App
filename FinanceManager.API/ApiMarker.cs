namespace FinanceManager.API;

/// <summary>
/// Marker type whose only job is to identify this assembly.
///
/// Top-level statements in Program.cs compile into an <c>internal</c> Program class,
/// which integration tests cannot name. WebApplicationFactory&lt;T&gt; only uses T to
/// locate the entry point assembly, so any public type here serves — this one exists
/// so the tests never have to reach for an unrelated class, and so Program.cs stays
/// free of test scaffolding.
/// </summary>
public sealed class ApiMarker
{
}
