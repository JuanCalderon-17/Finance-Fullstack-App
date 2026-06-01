using FinanceManager.API.DTOs;
using FinanceManager.API.Interfaces;
using FinanceManager.API.Models;
using Microsoft.AspNetCore.Authorization; // <--- IMPORTANTE para [AllowAnonymous]
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
        [EnableRateLimiting("auth")]
        public async Task<ActionResult> Register(RegisterDto registerDto)
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

            // Generate a verification token and save it — user can't log in until they confirm
            var verificationToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
            user.EmailVerificationToken = verificationToken;
            await _userManager.UpdateAsync(user);

            var verifyLink = $"https://finanzasbr.com/auth/verify-email?token={verificationToken}&email={user.Email}";
            var body = $@"
                <div style='font-family: Arial, sans-serif; padding: 20px;'>
                    <h2 style='color: #2c3e50;'>Verifica tu correo</h2>
                    <p>Gracias por registrarte en Finance Manager. Haz clic en el enlace para activar tu cuenta:</p>
                    <a href='{verifyLink}' style='background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Verificar correo</a>
                    <p style='margin-top: 20px; font-size: 12px; color: #7f8c8d;'>Si no creaste esta cuenta, ignora este correo.</p>
                </div>";

            try
            {
                await _emailService.SendEmailAsync(user.Email, "Verifica tu cuenta", body);
            }
            catch (Exception ex)
            {
                // Don't fail registration if email send fails — user can request a resend later
                Console.WriteLine($"--> [WARN] Verification email failed for {user.Email}: {ex.Message}");
                return Ok(new { message = "Cuenta creada, pero no pudimos enviar el correo de verificación. Solicita el reenvío.", emailSent = false });
            }

            return Ok(new { message = "Revisa tu correo para verificar tu cuenta.", emailSent = true });
        }

        // POST: api/account/login
        [HttpPost("login")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult<UserDto>> Login(LoginDto loginDto)
        {
            var user = await _userManager.Users.SingleOrDefaultAsync(u => u.UserName == loginDto.Username.ToLower());

            if (user == null) return Unauthorized("Email o contraseña inválidos.");

            if (!user.IsEmailVerified)
                return Unauthorized("Debes verificar tu correo antes de iniciar sesión.");

            var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, false);

            if (!result.Succeeded) return Unauthorized("Email o contraseña inválidos.");

            return new UserDto
            {
                Username = user.UserName,
                FullName = user.FullName,
                Token = _tokenService.CreateToken(user)
            };
        }

        // POST: api/account/forgot-password 
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
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

            // avoid false Cors error
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

        // GET: api/account/verify-email?token=xxx&email=xxx
        [HttpGet("verify-email")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyEmail([FromQuery] string token, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(email))
                return BadRequest(new { error = "Token y email son requeridos." });

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
                return BadRequest(new { error = "Usuario no encontrado." });

            if (user.IsEmailVerified)
                return Ok(new { message = "El correo ya fue verificado anteriormente." });

            if (user.EmailVerificationToken != token)
                return BadRequest(new { error = "Token inválido." });

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return StatusCode(500, new { error = "Error al verificar el correo." });

            return Ok(new { message = "¡Correo verificado! Ya puedes iniciar sesión." });
        }

        // POST: api/account/resend-verification
        [HttpPost("resend-verification")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto dto)
        {
            if (string.IsNullOrEmpty(dto.Email))
                return BadRequest(new { error = "El email es requerido." });

            var user = await _userManager.FindByEmailAsync(dto.Email);

            // Always return Ok to avoid leaking which emails are registered
            if (user == null)
                return Ok(new { message = "Si la cuenta existe, te enviamos un nuevo enlace." });

            if (user.IsEmailVerified)
                return BadRequest(new { error = "Esta cuenta ya está verificada." });

            // Issue a fresh token (invalidates the previous one)
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
            user.EmailVerificationToken = token;
            var update = await _userManager.UpdateAsync(user);
            if (!update.Succeeded)
                return StatusCode(500, new { error = "No se pudo generar el token." });

            var verifyLink = $"https://finanzasbr.com/auth/verify-email?token={token}&email={user.Email}";
            var body = $@"
                <div style='font-family: Arial, sans-serif; padding: 20px;'>
                    <h2 style='color: #2c3e50;'>Verifica tu correo</h2>
                    <p>Solicitaste un nuevo enlace de verificación. Haz clic abajo para activar tu cuenta:</p>
                    <a href='{verifyLink}' style='background-color: #3498db; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;'>Verificar correo</a>
                    <p style='margin-top: 20px; font-size: 12px; color: #7f8c8d;'>Si no solicitaste esto, ignora este correo.</p>
                </div>";

            try
            {
                await _emailService.SendEmailAsync(user.Email, "Verifica tu cuenta", body);
                return Ok(new { message = "Te enviamos un nuevo enlace de verificación." });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR] Resend verification email failed for {user.Email}: {ex.Message}");
                return StatusCode(500, new { error = "No pudimos enviar el correo. Intenta más tarde." });
            }
        }

        // POST: api/account/reset-password
        [HttpPost("reset-password")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
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

                // verify token
                if (user.PasswordResetToken != request.Token)
                {
                    return BadRequest(new { error = "Token inválido." });
                }

                // verify token expiration
                if (user.ResetTokenExpires < DateTime.UtcNow)
                {
                    return BadRequest(new { error = "El token ha expirado. Solicita uno nuevo." });
                }

                // Change password, no need to use token provider
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


        [HttpDelete]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> DeleteAccount([FromBody] DeleteAccountDto request)

    }
}