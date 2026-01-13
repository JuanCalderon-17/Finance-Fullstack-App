using System.Net;
using System.Net.Mail; 


namespace FinanceManager.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;

        public EmailService(IConfiguration configuration)
        {
            _config = configuration;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            // 1. Intentamos leer de appsettings (Local)
            var mailUser = _config["EmailSettings:User"];
            var mailPass = _config["EmailSettings:Password"];
            var mailHost = _config["EmailSettings:Host"];
            var mailPort = _config["EmailSettings:Port"];

            // 2. Si es nulo (estamos en Render), leemos la Variable de Entorno directa
            if (string.IsNullOrEmpty(mailUser)) mailUser = Environment.GetEnvironmentVariable("EMAIL_USERNAME");
            if (string.IsNullOrEmpty(mailPass)) mailPass = Environment.GetEnvironmentVariable("EMAIL_PASSWORD");
            if (string.IsNullOrEmpty(mailHost)) mailHost = Environment.GetEnvironmentVariable("EMAIL_HOST");

            // El puerto necesita un trato especial para convertirlo a int
            if (string.IsNullOrEmpty(mailPort)) mailPort = Environment.GetEnvironmentVariable("EMAIL_PORT");

            // 3. Validación de seguridad (Esto evitará el error "Value cannot be null")
            if (string.IsNullOrEmpty(mailUser)) throw new Exception("ERROR: La variable 'EMAIL_USERNAME' está vacía o no se encuentra.");
            if (string.IsNullOrEmpty(mailPass)) throw new Exception("ERROR: La variable 'EMAIL_PASSWORD' está vacía.");

            // Parsear el puerto (usar 587 por defecto si falla)
            if (!int.TryParse(mailPort, out int port)) port = 587;

            // --- AQUÍ OCURRÍA TU ERROR ANTES (Al crear new MailAddress con null) ---
            var client = new SmtpClient(mailHost, port)
            {
                Credentials = new NetworkCredential(mailUser, mailPass),
                EnableSsl = true,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(mailUser), // <--- Aquí fallaba porque mailUser era NULL
                Subject = subject,
                Body = body,
                IsBodyHtml = true
            };

            mailMessage.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> Error SMTP: {ex.Message}");
                throw;
            }
        }

    }
}
