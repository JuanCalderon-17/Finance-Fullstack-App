using System.Text;
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

// --- CONFIGURACIÓN 100% POSTGRESQL (PARA RENDER) ---
builder.Services.AddDbContext<AppDbContext>(options =>
{
    // 1. Intentamos leer la URL de la base de datos de Render
    var dbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");

    if (!string.IsNullOrEmpty(dbUrl))
    {
        // ESTAMOS EN RENDER
        Console.WriteLine("--> Usando Base de Datos de Render (Postgres)");
        var databaseUri = new Uri(dbUrl);
        var userInfo = databaseUri.UserInfo.Split(':');
        var port = databaseUri.Port > 0 ? databaseUri.Port : 5432;

        connectionString = $"Host={databaseUri.Host};Port={port};Database={databaseUri.LocalPath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};Ssl Mode=Require;Trust Server Certificate=true";
    }

    // Forzamos el uso de Npgsql (Postgres)
    options.UseNpgsql(connectionString);
});
// ----------------------------------------------------

builder.Services.AddIdentityCore<AppUser>(opt => { opt.Password.RequireNonAlphanumeric = false; })
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager<SignInManager<AppUser>>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["TokenKey"])),
            ValidateIssuer = false,
            ValidateAudience = false,
        };
    });

builder.Services.AddScoped<ITokenService, TokenService>();

// 👇👇👇 AQUÍ ESTÁ EL CAMBIO CLAVE (La Llave Maestra) 👇👇👇
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp", policy =>
    {
        // Permitimos CUALQUIER origen, CUALQUIER cabecera y CUALQUIER método.
        // Esto elimina el error de bloqueo inmediatamente.
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
// 👆👆👆 FIN DEL CAMBIO 👆👆👆

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
        { new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" }, Scheme = "oauth2", Name = "Bearer", In = ParameterLocation.Header, }, new List<string>() }
    });
});

var app = builder.Build();

// === MIGRACIÓN AUTOMÁTICA EN LA NUBE ===
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        context.Database.Migrate(); // Esto crea la tabla de Savings en Render
        Console.WriteLine("--> ¡Migraciones aplicadas en Render!");
    }
    catch (Exception ex) { Console.WriteLine($"--> Error migraciones: {ex.Message}"); }
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Activamos la política CORS que definimos arriba
app.UseCors("AllowAngularApp");

app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.Run();