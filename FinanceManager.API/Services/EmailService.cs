using MimeKit;
using MailKit.Net.Smtp;
using MailKit.Security; // Necesario para SecureSocketOptions
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;
using FinanceManager.API.Interfaces; // Asegúrate de que este namespace coincida con el tuyo

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
            // 1. Leer configuración (igual que antes)
            var mailUser = _config["EmailSettings:User"];
            var mailPass = _config["EmailSettings:Password"];
            var mailHost = _config["EmailSettings:Host"];
            var mailPort = _config["EmailSettings:Port"];

            if (string.IsNullOrEmpty(mailUser)) mailUser = Environment.GetEnvironmentVariable("EMAIL_USERNAME");
            if (string.IsNullOrEmpty(mailPass)) mailPass = Environment.GetEnvironmentVariable("EMAIL_PASSWORD");
            if (string.IsNullOrEmpty(mailHost)) mailHost = Environment.GetEnvironmentVariable("EMAIL_HOST");
            if (string.IsNullOrEmpty(mailPort)) mailPort = Environment.GetEnvironmentVariable("EMAIL_PORT");

            if (!int.TryParse(mailPort, out int port)) port = 587;

            // 2. Crear el mensaje usando MimeKit (Más moderno)
            var email = new MimeMessage();
            email.From.Add(MailboxAddress.Parse(mailUser));
            email.To.Add(MailboxAddress.Parse(toEmail));
            email.Subject = subject;

            // Cuerpo del correo en HTML
            var builder = new BodyBuilder();
            builder.HtmlBody = body;
            email.Body = builder.ToMessageBody();

            // 3. Enviar usando MailKit (Aquí está la magia que arregla el error 101)
            using var smtp = new SmtpClient();
            try
            {
                // Connect(host, port, options):
                // StartTls es la opción correcta para el puerto 587 de Gmail
                await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.StartTls);

                // Autenticación
                await smtp.AuthenticateAsync(mailUser, mailPass);

                // Enviar
                await smtp.SendAsync(email);

                // Desconectar limpiamente
                await smtp.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                // Este log aparecerá en Render si algo falla
                Console.WriteLine($"--> Error MailKit: {ex.Message}");
                throw;
            }
        }
    }
}