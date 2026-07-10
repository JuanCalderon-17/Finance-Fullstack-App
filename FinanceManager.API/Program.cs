using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using FinanceManager.API.Data;
using FinanceManager.API.Interfaces;
using FinanceManager.API.Models;
using FinanceManager.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();

//configuration for Render deployment
// Resolve the connection string once at startup, probing each candidate with a
// real 5-second connection attempt. A stale DATABASE_URL (e.g. an expired free
// Render Postgres) then falls back to DefaultConnection instead of taking every
// endpoint down with generic 500s.
string BuildConnectionStringFromUrl(string dbUrl)
{
    var databaseUri = new Uri(dbUrl);
    var userInfo = databaseUri.UserInfo.Split(':', 2);
    var username = Uri.UnescapeDataString(userInfo[0]);
    var password = userInfo.Length > 1 ? Uri.UnescapeDataString(userInfo[1]) : "";
    var port = databaseUri.Port > 0 ? databaseUri.Port : 5432;

    return $"Host={databaseUri.Host};Port={port};Database={databaseUri.LocalPath.TrimStart('/')};Username={username};Password={password};Ssl Mode=Require;Trust Server Certificate=true";
}

var connectionCandidates = new List<(string Source, string Value)>();

var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
if (!string.IsNullOrEmpty(databaseUrl))
{
    try
    {
        connectionCandidates.Add(("DATABASE_URL", BuildConnectionStringFromUrl(databaseUrl)));
    }
    catch (Exception ex)
    {
        Console.WriteLine($"--> [WARN] DATABASE_URL is malformed, skipping it: {ex.Message}");
    }
}

var defaultConnection = builder.Configuration.GetConnectionString("DefaultConnection");
if (!string.IsNullOrWhiteSpace(defaultConnection))
{
    connectionCandidates.Add(("ConnectionStrings:DefaultConnection", defaultConnection));
}

if (connectionCandidates.Count == 0)
{
    throw new InvalidOperationException(
        "No database configured. Set the DATABASE_URL environment variable " +
        "or ConnectionStrings:DefaultConnection.");
}

var activeConnectionString = connectionCandidates[0].Value;
foreach (var (source, candidate) in connectionCandidates)
{
    try
    {
        var probe = new Npgsql.NpgsqlConnectionStringBuilder(candidate) { Timeout = 5 };
        using var probeConnection = new Npgsql.NpgsqlConnection(probe.ConnectionString);
        probeConnection.Open();
        Console.WriteLine($"--> Base de datos conectada usando {source}");
        activeConnectionString = candidate;
        break;
    }
    catch (Exception ex)
    {
        Console.WriteLine($"--> [WARN] {source} no acepta conexiones: {ex.Message}");
    }
}

builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(activeConnectionString));



// passwords are hashshed to protect from vulnerabilites 

builder.Services.AddIdentityCore<AppUser>(opt => { opt.Password.RequireNonAlphanumeric = false; })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager<SignInManager<AppUser>>();

// Fail fast with a clear message instead of booting an app that can't sign/validate tokens.
// HMAC-SHA512 needs a key of at least 64 bytes.
var tokenKey = builder.Configuration["TokenKey"];
if (string.IsNullOrWhiteSpace(tokenKey) || tokenKey.Length < 64)
{
    throw new InvalidOperationException(
        "TokenKey is not configured or is shorter than 64 characters. " +
        "Set the TokenKey environment variable (production) or user secrets (local dev).");
}

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(tokenKey)),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "finanzasbr.com",
            ValidateAudience = true,
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "finanzasbr-app",
            ValidateLifetime = true,
            ClockSkew = TimeSpan.Zero
        };
    });


// register services for user management, token generation, and email sending

builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddHttpClient<IEmailService, EmailService>();

// service for fetching currency exchange rates from an external API
builder.Services.AddHttpClient<ICurrencyService, CurrencyService>();



// Rate limiting — bouncer rules for our API endpoints
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = 429;

    // Global DoS protection: 100 requests/min per client IP across every
    // endpoint. Auth endpoints stack the stricter "auth" limiter on top.
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
    {
        var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        return RateLimitPartition.GetFixedWindowLimiter(ip, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 100,
            Window = TimeSpan.FromMinutes(1),
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            QueueLimit = 0
        });
    });

    // Strict limit for auth endpoints (login, register, forgot-password)
    // 5 attempts per minute per IP — stops brute-force and email spam
    options.AddFixedWindowLimiter("auth", o =>
    {
        o.PermitLimit = 5;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });

    // Moderate limit for currency endpoint
    // 30 requests per minute per IP — protects external API quota
    options.AddFixedWindowLimiter("currency", o =>
    {
        o.PermitLimit = 30;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });

    // Default global limit for all other endpoints
    // 100 requests per minute per IP — general DoS protection
    options.AddFixedWindowLimiter("general", o =>
    {
        o.PermitLimit = 100;
        o.Window = TimeSpan.FromMinutes(1);
        o.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        o.QueueLimit = 0;
    });
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        policy.WithOrigins(
                "http://localhost:4200",
                "https://finanzasbr.com",
                "https://www.finanzasbr.com",
                "https://finanancemanagerpp.vercel.app"
              )
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement()
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header,
            },
            new List<string>()
        }
    });
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        context.Database.Migrate();
        Console.WriteLine("--> ¡Migraciones aplicadas en Render!");
    }
    catch (Exception ex)
    {
        // Log the FULL exception (inner exceptions carry the real DB error);
        // the app still boots so /api/health can report the database as down.
        Console.WriteLine($"--> Error migraciones: {ex}");
    }
}

// Convert unhandled exceptions into a clean JSON 500 instead of leaking stack traces.
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        context.Response.StatusCode = 500;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new { error = "An unexpected error occurred." });
    });
});

if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Baseline security headers (API serves JSON only).
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "DENY";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
    await next();
});

app.UseCors("AllowAngularApp");

// Tell ASP.NET to trust X-Forwarded-For from Render's proxy so the rate
// limiter sees the real client IP, not the proxy's IP.
app.UseForwardedHeaders(new ForwardedHeadersOptions
{
    ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto
});

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health check pings the database so a dead DB shows up here as 503
// instead of hiding behind generic 500s on real endpoints.
app.MapGet("/api/health", async (AppDbContext db) =>
{
    var dbOk = false;
    try
    {
        dbOk = await db.Database.CanConnectAsync();
    }
    catch
    {
        // CanConnectAsync normally returns false rather than throwing, but be safe
    }

    return dbOk
        ? Results.Ok(new { status = "ok", database = "ok", timestamp = DateTime.UtcNow })
        : Results.Json(new { status = "degraded", database = "unreachable", timestamp = DateTime.UtcNow }, statusCode: 503);
}).AllowAnonymous();

app.Run();