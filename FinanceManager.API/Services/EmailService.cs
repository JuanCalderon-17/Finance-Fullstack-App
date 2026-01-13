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
            // Asegúrate de leer esto de tu configuración o variables de entorno
            var smtpHost = _config["EmailSettings:Host"]; // o Environment.GetEnvironmentVariable("EMAIL_HOST")
            var smtpPort = int.Parse(_config["EmailSettings:Port"]);
            var smtpUser = _config["EmailSettings:User"];
            var smtpPass = _config["EmailSettings:Password"];

            var client = new SmtpClient(smtpHost, smtpPort)
            {
                Credentials = new NetworkCredential(smtpUser, smtpPass),
                EnableSsl = true, // <--- IMPORTANTE PARA GMAIL
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(smtpUser),
                Subject = subject,
                Body = body,
                IsBodyHtml = true // Si envías HTML
            };

            mailMessage.To.Add(toEmail);

            try
            {
                await client.SendMailAsync(mailMessage);
            }
            catch (Exception ex)
            {
                // Esto evitará que tu servidor explote y verás el error real en consola
                Console.WriteLine($"--> Error enviando correo: {ex.Message}");
                throw; // O lánzalo para que el Controller lo maneje, pero ya sabrás qué pasó.
            }
        }

    }
}
