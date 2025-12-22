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


// --- INICIO DE NUESTRO CÓDIGO DE CONFIGURACIÓN ---

// 1. Configuración de la Base de Datos
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

// 2. Configuración de ASP.NET Core Identity
builder.Services.AddIdentityCore<AppUser>(opt =>
{
    opt.Password.RequireNonAlphanumeric = false;
})
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager<SignInManager<AppUser>>();

// 3. Configuración de la Autenticación con JWT
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

// 4. Registro de nuestro servicio de tokens
builder.Services.AddScoped<ITokenService, TokenService>();


// 5. Le damos permiso a nuestra app de Angular para que hable con la API
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularApp",
        policy =>
        {
            policy.WithOrigins("http://localhost:4200") // La dirección de nuestra app de Angular
                  .AllowAnyHeader()
                  .AllowAnyMethod();
        });
});


// 6. Configuración de Swagger para que entienda JWT
builder.Services.AddSwaggerGen(options =>
{
    // Definimos el esquema de seguridad "Bearer"
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    // Añadimos el requisito de que se puede usar este esquema de seguridad
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






// --- FIN DE NUESTRO CÓDIGO DE CONFIGURACIÓN ---


var app = builder.Build();

// === INICIO: AUTO-MIGRACIÓN (El Robot Obrero) ===
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try
    {
        var context = services.GetRequiredService<AppDbContext>();
        // Esto revisa si hay cambios pendientes y crea las tablas si no existen
        context.Database.Migrate();
        Console.WriteLine("--> ¡Migraciones aplicadas con éxito en la Nube! ");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"--> Error aplicando migraciones: {ex.Message}");
    }
}
// === FIN: AUTO-MIGRACIÓN ===


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseCors("AllowAngularApp");

// Middleware de Autenticación y Autorización
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();