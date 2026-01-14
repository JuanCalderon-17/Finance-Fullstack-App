using FinanceManager.API.DTOs;
using FinanceManager.API.Interfaces;
using FinanceManager.API.Models;
using Microsoft.AspNetCore.Authorization; // <--- IMPORTANTE para [AllowAnonymous]
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Cryptography; // Necesario para el Token Random
using System.Text;
using FinanceManager.API.Services;  

namespace FinanceManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly SignInManager<AppUser> _signInManager;
        private readonly ITokenService _tokenService;
        private readonly IEmailService _emailService;

        public AccountController(
            UserManager<AppUser> userManager,
            SignInManager<AppUser> signInManager,
            ITokenService tokenService,
            IEmailService emailService)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _tokenService = tokenService;
            _emailService = emailService;
        }

        // POST: api/account/register
        [HttpPost("register")]
        public async Task<ActionResult<UserDto>> Register(RegisterDto registerDto)
        {
            if (await _userManager.Users.AnyAsync(u => u.Email == registerDto.Email.ToLower()))
            {
                return BadRequest("El email ya está en uso.");
            }

            var user = new AppUser
            {
                UserName = registerDto.Email.ToLower(),
                Email = registerDto.Email.ToLower(),
                FullName = registerDto.FullName
            };

            var result = await _userManager.CreateAsync(user, registerDto.Password);

            if (!result.Succeeded) return BadRequest(result.Errors);

            return new UserDto
            {
                Username = user.Email,
                FullName = user.FullName,
                Token = _tokenService.CreateToken(user)
            };
        }

        // POST: api/account/login
        [HttpPost("login")]
        public async Task<ActionResult<UserDto>> Login(LoginDto loginDto)
        {
            var user = await _userManager.Users.SingleOrDefaultAsync(u => u.UserName == loginDto.Username.ToLower());

            if (user == null) return Unauthorized("Email o contraseña inválidos.");

            var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, false);

            if (!result.Succeeded) return Unauthorized("Email o contraseña inválidos.");

            return new UserDto
            {
                Username = user.UserName,
                FullName = user.FullName,
                Token = _tokenService.CreateToken(user)
            };
        }

        // ---------------------------------------------------------
        // POST: api/account/forgot-password (VERSIÓN BLINDADA)
        // ---------------------------------------------------------
        [HttpPost("forgot-password")]
        [AllowAnonymous] // <--- 1. CRUCIAL: Permite acceso sin login
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
        {
            // Validamos que venga el email
            if (string.IsNullOrEmpty(request.Email)) return BadRequest("El email es requerido.");

            var user = await _userManager.FindByEmailAsync(request.Email);
            // Por seguridad, a veces es mejor retornar Ok() aunque no exista, 
            // pero para debug dejaremos el BadRequest si no lo encuentra.
            if (user == null) return BadRequest("Usuario no encontrado.");

            // Generar token random
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));

            // Guardar en DB
            user.PasswordResetToken = token;
            user.ResetTokenExpires = DateTime.UtcNow.AddMinutes(15);

            // Importante: Asegurar que se guarde antes de enviar el correo
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded) return BadRequest("Error al generar el token.");

            // 2. CORREGIDO: El link debe apuntar a tu FRONTEND (Vercel), no al backend
            // Usé la URL que vi en tus logs: https://finanancemanagerpp.vercel.app
            var resetLink = $"https://finanzasbr.com/auth/reset-password?token={token}&email={request.Email}";

            var body = $@"
                <div style='font-family: Arial, sans-serif; padding: 20px;'>
                    <h2 style='color: #2c3e50;'>Recuperación de Contraseña</h2>
                    <p>Has solicitado restablecer tu contraseña en Finance Manager.</p>
                    <p>Haz clic en el siguiente enlace para continuar:</p>
                    <a href='{resetLink}' style='background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Restablecer Contraseña</a>
                    <p style='margin-top: 20px; font-size: 12px; color: #7f8c8d;'>Si no solicitaste esto, ignora este correo.</p>
                </div>";

            // 3. BLINDAJE TRY-CATCH: Esto evita el error de CORS falso
            try
            {
                await _emailService.SendEmailAsync(request.Email, "Recuperar Contraseña", body);

                // Respuesta JSON correcta para Angular
                return Ok(new { message = "¡Enlace enviado! Revisa tu correo." });
            }
            catch (Exception ex)
            {
                // Si falla el correo, lo atrapamos y devolvemos el error real
                Console.WriteLine($"--> [ERROR CONTROLADO] Falló envío email: {ex.Message}");
                return BadRequest(new { error = $"No se pudo enviar el correo: {ex.Message}" });
            }
        }

        // POST: api/account/reset-password
        [HttpPost("reset-password")]
        [AllowAnonymous]
        public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordDto request)
        {
            try
            {
                if (string.IsNullOrEmpty(request.Email) || string.IsNullOrEmpty(request.Token) || string.IsNullOrEmpty(request.NewPassword))
                {
                    return BadRequest(new { error = "Todos los campos son requeridos." });
                }

                var user = await _userManager.FindByEmailAsync(request.Email);
                if (user == null)
                {
                    return BadRequest(new { error = "Usuario no encontrado." });
                }

                // Verificar token
                if (user.PasswordResetToken != request.Token)
                {
                    return BadRequest(new { error = "Token inválido." });
                }

                // Verificar expiración
                if (user.ResetTokenExpires < DateTime.UtcNow)
                {
                    return BadRequest(new { error = "El token ha expirado. Solicita uno nuevo." });
                }

                // Cambiar contraseña directamente (sin usar el Token Provider)
                var passwordHasher = new PasswordHasher<AppUser>();
                user.PasswordHash = passwordHasher.HashPassword(user, request.NewPassword);

                // Limpiar token
                user.PasswordResetToken = null;
                user.ResetTokenExpires = null;

                var result = await _userManager.UpdateAsync(user);

                if (!result.Succeeded)
                {
                    return BadRequest(new { error = "Error al cambiar la contraseña." });
                }

                Console.WriteLine($"--> [ÉXITO] Contraseña cambiada para: {user.Email}");
                return Ok(new { message = "Contraseña restablecida correctamente." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR RESET PASSWORD] {ex.Message}");
                return StatusCode(500, new { error = "Error interno del servidor." });
            }
        }

    }
}