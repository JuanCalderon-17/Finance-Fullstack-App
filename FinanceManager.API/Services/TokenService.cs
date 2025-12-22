using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using FinanceManager.API.Interfaces;
using FinanceManager.API.Models;
using Microsoft.IdentityModel.Tokens;

namespace FinanceManager.API.Services
{
    // Esta es la implementación real de nuestro servicio de tokens.
    public class TokenService : ITokenService
    {
        private readonly SymmetricSecurityKey _key;

        // Inyectamos la configuración para poder leer nuestra clave secreta.
        public TokenService(IConfiguration config)
        {
            // La clave secreta se usa para firmar el token. Debe ser lo suficientemente larga y compleja.
            // La leemos desde nuestros archivos de configuración (appsettings.json).
            _key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(config["TokenKey"]));
        }

        public string CreateToken(AppUser user)
        {
            // 1. Claims: Estas son las "piezas de información" que guardamos dentro del token.
            //    Tu selección de claims es excelente y muy completa.
            var claims = new List<Claim>
            {
                new Claim(JwtRegisteredClaimNames.NameId, user.Id), // El ID del usuario (el más importante)
                new Claim(JwtRegisteredClaimNames.Sub, user.UserName), // El nombre de usuario
                new Claim(JwtRegisteredClaimNames.Email, user.Email), // El email
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()) // Un ID único para el token
            };

            // 2. Credentials: Creamos las credenciales para firmar el token.
            var creds = new SigningCredentials(_key, SecurityAlgorithms.HmacSha512Signature);

            // 3. Token Descriptor: Describimos el token de forma clara y moderna.
            var tokenDescriptor = new SecurityTokenDescriptor
            {
                Subject = new ClaimsIdentity(claims),
                Expires = DateTime.Now.AddDays(7),
                SigningCredentials = creds
            };

            // 4. Token Handler: El manejador crea y escribe el token.
            var tokenHandler = new JwtSecurityTokenHandler();
            var token = tokenHandler.CreateToken(tokenDescriptor);

            return tokenHandler.WriteToken(token);
        }
    }
}
