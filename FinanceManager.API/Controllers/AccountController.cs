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
using System.Security.Claims;

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

        // Reset/verification tokens are bearer secrets: email the raw token to the
        // user but only ever persist its SHA-256 hash, so a DB leak can't be replayed.
        private static string HashToken(string token)
        {
            using var sha = System.Security.Cryptography.SHA256.Create();
            var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(token));
            return Convert.ToHexString(bytes);
        }

        // POST: api/account/register
        [HttpPost("register")]
        [EnableRateLimiting("auth")]
        public async Task<ActionResult> Register(RegisterDto registerDto)
        {
            if (await _userManager.Users.AnyAsync(u => u.Email == registerDto.Email.ToLower()))
            {
                return BadRequest(new { error = "El email ya está en uso.", code = "EMAIL_IN_USE" });
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
            user.EmailVerificationToken = HashToken(verificationToken);
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
                return Ok(new { message = "Cuenta creada, pero no pudimos enviar el correo de verificación. Solicita el reenvío.", code = "CREATED_EMAIL_FAILED", emailSent = false });
            }

            return Ok(new { message = "Revisa tu correo para verificar tu cuenta.", code = "VERIFICATION_SENT", emailSent = true });
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
                Token = _tokenService.CreateToken(user),
                ProfilePictureUrl = user.ProfilePictureUrl
            };
        }

        // POST: api/account/forgot-password 
        [HttpPost("forgot-password")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordDto request)
        {
            // Validamos que venga el email
            if (string.IsNullOrEmpty(request.Email)) return BadRequest(new { error = "El email es requerido.", code = "EMAIL_REQUIRED" });

            var user = await _userManager.FindByEmailAsync(request.Email);
            // Respuesta genérica: no revelar qué emails tienen cuenta registrada.
            // Mismo code que el envío real, si no el cliente delataría la cuenta.
            if (user == null)
                return Ok(new { message = "Si la cuenta existe, te enviamos un enlace. Revisa tu correo.", code = "RESET_LINK_SENT" });

            // Generar token random
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));

            // Guardar en DB (solo el hash; el enlace lleva el token en claro)
            user.PasswordResetToken = HashToken(token);
            user.ResetTokenExpires = DateTime.UtcNow.AddMinutes(15);

            // Importante: Asegurar que se guarde antes de enviar el correo
            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded) return BadRequest(new { error = "Error al generar el token.", code = "TOKEN_GENERATION_FAILED" });

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
                return Ok(new { message = "¡Enlace enviado! Revisa tu correo.", code = "RESET_LINK_SENT" });
            }
            catch (Exception ex)
            {
                // El detalle del provider va al log, no al cliente: filtraba interno al navegador
                Console.WriteLine($"--> [ERROR CONTROLADO] Falló envío email: {ex.Message}");
                return BadRequest(new { error = "No se pudo enviar el correo.", code = "EMAIL_SEND_FAILED" });
            }
        }

        // GET: api/account/verify-email?token=xxx&email=xxx
        [HttpGet("verify-email")]
        [AllowAnonymous]
        public async Task<IActionResult> VerifyEmail([FromQuery] string token, [FromQuery] string email)
        {
            if (string.IsNullOrEmpty(token) || string.IsNullOrEmpty(email))
                return BadRequest(new { error = "Token y email son requeridos.", code = "MISSING_TOKEN" });

            var user = await _userManager.FindByEmailAsync(email);
            if (user == null)
                return BadRequest(new { error = "Usuario no encontrado.", code = "USER_NOT_FOUND" });

            if (user.IsEmailVerified)
                return Ok(new { message = "El correo ya fue verificado anteriormente.", code = "ALREADY_VERIFIED" });

            if (user.EmailVerificationToken != HashToken(token))
                return BadRequest(new { error = "Token inválido.", code = "INVALID_TOKEN" });

            user.IsEmailVerified = true;
            user.EmailVerificationToken = null;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded)
                return StatusCode(500, new { error = "Error al verificar el correo.", code = "VERIFY_FAILED" });

            return Ok(new { message = "¡Correo verificado! Ya puedes iniciar sesión.", code = "EMAIL_VERIFIED" });
        }

        // POST: api/account/resend-verification
        [HttpPost("resend-verification")]
        [AllowAnonymous]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> ResendVerification([FromBody] ResendVerificationDto dto)
        {
            if (string.IsNullOrEmpty(dto.Email))
                return BadRequest(new { error = "El email es requerido.", code = "EMAIL_REQUIRED" });

            var user = await _userManager.FindByEmailAsync(dto.Email);

            // Always return Ok to avoid leaking which emails are registered
            if (user == null)
                return Ok(new { message = "Si la cuenta existe, te enviamos un nuevo enlace.", code = "VERIFICATION_RESENT" });

            if (user.IsEmailVerified)
                return BadRequest(new { error = "Esta cuenta ya está verificada.", code = "ALREADY_VERIFIED" });

            // Issue a fresh token (invalidates the previous one)
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));
            user.EmailVerificationToken = HashToken(token);
            var update = await _userManager.UpdateAsync(user);
            if (!update.Succeeded)
                return StatusCode(500, new { error = "No se pudo generar el token.", code = "TOKEN_GENERATION_FAILED" });

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
                return Ok(new { message = "Te enviamos un nuevo enlace de verificación.", code = "VERIFICATION_RESENT" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR] Resend verification email failed for {user.Email}: {ex.Message}");
                return StatusCode(500, new { error = "No pudimos enviar el correo. Intenta más tarde.", code = "EMAIL_SEND_FAILED" });
            }
        }

        // PUT: api/account/profile
        [HttpPut("profile")]
        [Authorize]
        public async Task<IActionResult> UpdateProfile([FromBody] UpdateProfileDto dto)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var user = await _userManager.FindByIdAsync(userId!);
            if (user == null) return NotFound();

            user.FullName = dto.FullName;
            user.ProfilePictureUrl = dto.ProfilePictureUrl;

            var result = await _userManager.UpdateAsync(user);
            if (!result.Succeeded) return BadRequest(result.Errors);

            return Ok(new UserDto
            {
                Username = user.UserName!,
                FullName = user.FullName,
                Token = _tokenService.CreateToken(user),
                ProfilePictureUrl = user.ProfilePictureUrl
            });
        }

        // POST: api/account/change-password
        [HttpPost("change-password")]
        [Authorize]
        public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordDto dto)
        {
            var userId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
            var user = await _userManager.FindByIdAsync(userId!);
            if (user == null) return NotFound();

            var result = await _userManager.ChangePasswordAsync(user, dto.CurrentPassword, dto.NewPassword);
            if (!result.Succeeded) return BadRequest(result.Errors);

            return Ok(new { message = "Password updated." });
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
                    return BadRequest(new { error = "Todos los campos son requeridos.", code = "FIELDS_REQUIRED" });
                }

                var user = await _userManager.FindByEmailAsync(request.Email);
                if (user == null)
                {
                    return BadRequest(new { error = "Usuario no encontrado.", code = "USER_NOT_FOUND" });
                }

                // verify token — la BD guarda el hash SHA-256, el enlace lleva el token en claro
                if (user.PasswordResetToken != HashToken(request.Token))
                {
                    return BadRequest(new { error = "Token inválido.", code = "INVALID_TOKEN" });
                }

                // verify token expiration
                if (user.ResetTokenExpires < DateTime.UtcNow)
                {
                    return BadRequest(new { error = "El token ha expirado. Solicita uno nuevo.", code = "TOKEN_EXPIRED" });
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
                    return BadRequest(new { error = "Error al cambiar la contraseña.", code = "RESET_FAILED" });
                }

                Console.WriteLine($"--> [ÉXITO] Contraseña cambiada para: {user.Email}");
                return Ok(new { message = "Contraseña restablecida correctamente.", code = "PASSWORD_RESET" });
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR RESET PASSWORD] {ex.Message}");
                return StatusCode(500, new { error = "Error interno del servidor.", code = "SERVER_ERROR" });
            }
        }

        [Authorize]
        [HttpDelete]
        [EnableRateLimiting("auth")]
        public async Task<IActionResult> DeleteAccount([FromBody]DeleteAccountDto deleteAccountDto)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
            if (userId == null) return Unauthorized();
        
            var user =  await _userManager.FindByIdAsync(userId);
            if (user == null) return NotFound();

            var isPasswordValid = await _userManager.CheckPasswordAsync(user, deleteAccountDto.Password);
            if (!isPasswordValid)
            {
                return BadRequest( new { message = "Invalid credentials provided"});
            }
            
            var result = await _userManager.DeleteAsync(user);

            if (!result.Succeeded)
            {
                return BadRequest(result.Errors);
            }

            return NoContent();
            
        }

    }
}