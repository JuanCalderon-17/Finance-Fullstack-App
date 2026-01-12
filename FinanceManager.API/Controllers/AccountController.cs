using System.Security.Cryptography; // Necesario para el Token Random
using System.Text;
using FinanceManager.API.DTOs;
using FinanceManager.API.Interfaces;
using FinanceManager.API.Models;
using FinanceManager.API.Services; // Para IEmailService
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FinanceManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AccountController : ControllerBase
    {
        private readonly UserManager<AppUser> _userManager;
        private readonly SignInManager<AppUser> _signInManager;
        private readonly ITokenService _tokenService;
        private readonly IEmailService _emailService; // <--- ¡AQUÍ ESTÁ TU SERVICIO DE EMAIL!

        public AccountController(
            UserManager<AppUser> userManager,
            SignInManager<AppUser> signInManager,
            ITokenService tokenService,
            IEmailService emailService) // Inyectamos el servicio
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _tokenService = tokenService;
            _emailService = emailService;
        }

        // POST: api/account/register (ARREGLADO)
        [HttpPost("register")]
        public async Task<ActionResult<UserDto>> Register(RegisterDto registerDto)
        {
            // 1. Validamos que el email no exista
            if (await _userManager.Users.AnyAsync(u => u.Email == registerDto.Email.ToLower()))
            {
                return BadRequest("El email ya está en uso.");
            }

            // 2. Creamos el usuario USANDO EL EMAIL COMO USERNAME
            var user = new AppUser
            {
                UserName = registerDto.Email.ToLower(), // Truco clave
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

        // POST: api/account/login (NORMAL)
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

        // POST: api/account/forgot-password (TU NUEVA FUNCIONALIDAD)
        [HttpPost("forgot-password")]
        public async Task<IActionResult> ForgotPassword(ForgotPasswordDto request)
        {
            var user = await _userManager.FindByEmailAsync(request.Email);
            if (user == null) return BadRequest("Usuario no encontrado.");

            // Generar token random
            var token = Convert.ToHexString(RandomNumberGenerator.GetBytes(64));

            // Guardar en DB
            user.PasswordResetToken = token;
            user.ResetTokenExpires = DateTime.UtcNow.AddMinutes(15);
            await _userManager.UpdateAsync(user);

            // Crear Link (Asegúrate de cambiar localhost por tu URL de Render cuando quieras probar el link final, pero para ver si llega el correo sirve así)
            var resetLink = $"https://finance-fullstack-app.onrender.com/auth/reset-password?token={token}&email={request.Email}";

            var body = $@"
                <h1>Recuperar Contraseña</h1>
                <p>Has solicitado restablecer tu contraseña.</p>
                <p>Haz clic aquí:</p>
                <a href='{resetLink}'>Restablecer Password</a>";

            // Enviar Email
            await _emailService.SendEmailAsync(request.Email, "Restablecer Password - Finance App", body);

            return Ok("Correo enviado con éxito.");
        }
    }
}