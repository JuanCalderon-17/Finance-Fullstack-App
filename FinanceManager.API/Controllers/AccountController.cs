// Archivo: Controllers/AccountController.cs

using FinanceManager.API.DTOs;
using FinanceManager.API.Interfaces; // No olvides este using para ITokenService
using FinanceManager.API.Models;
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
        private readonly SignInManager<AppUser> _signInManager; // Experto en logins
        private readonly ITokenService _tokenService; // Experto en crear tokens

        // Inyectamos todos los servicios que necesitamos en el constructor
        public AccountController(UserManager<AppUser> userManager, SignInManager<AppUser> signInManager, ITokenService tokenService)
        {
            _userManager = userManager;
            _signInManager = signInManager;
            _tokenService = tokenService;
        }

        // Endpoint para registrar un nuevo usuario
        // POST: api/account/register
        [HttpPost("register")]
        public async Task<ActionResult<UserDto>> Register(RegisterDto registerDto)
        {
            if (await _userManager.Users.AnyAsync(u => u.UserName == registerDto.Username.ToLower()))
            {
                return BadRequest("El nombre de usuario ya está en uso.");
            }

            if (await _userManager.Users.AnyAsync(u => u.Email == registerDto.Email.ToLower()))
            {
                return BadRequest("El email ya está en uso.");
            }

            var user = new AppUser
            {
                UserName = registerDto.Username.ToLower(),
                Email = registerDto.Email.ToLower()
            };

            var result = await _userManager.CreateAsync(user, registerDto.Password);

            if (!result.Succeeded)
            {
                return BadRequest(result.Errors);
            }

            // Al registrar, también le damos un token para que inicie sesión automáticamente
            return new UserDto
            {
                Username = user.UserName,
                Token = _tokenService.CreateToken(user) // Usamos nuestro servicio
            };
        }

        // Endpoint para iniciar sesión
        // POST: api/account/login
        [HttpPost("login")]
        public async Task<ActionResult<UserDto>> Login(LoginDto loginDto)
        {
            // 1. Buscamos al usuario
            var user = await _userManager.Users.SingleOrDefaultAsync(u => u.UserName == loginDto.Username.ToLower());

            if (user == null)
            {
                return Unauthorized("Usuario o contraseña inválidos.");
            }

            // 2. Usamos SignInManager para verificar la contraseña
            var result = await _signInManager.CheckPasswordSignInAsync(user, loginDto.Password, false);

            if (!result.Succeeded)
            {
                return Unauthorized("Usuario o contraseña inválidos.");
            }

            // 3. Si todo es correcto, creamos y devolvemos el token.
            return new UserDto
            {
                Username = user.UserName,
                Token = _tokenService.CreateToken(user) // ¡Aquí está la magia!
            };
        }
    }
}
