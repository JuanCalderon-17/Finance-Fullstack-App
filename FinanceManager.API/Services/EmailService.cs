using MimeKit;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using System;
using System.Threading.Tasks;
using FinanceManager.API.Interfaces;

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
            var mailUser = _config["EmailSettings:User"];
            var mailPass = _config["EmailSettings:Password"];
            var mailHost = _config["EmailSettings:Host"];
            var mailPort = _config["EmailSettings:Port"];

            if (string.IsNullOrEmpty(mailUser)) mailUser = Environment.GetEnvironmentVariable("EMAIL_USERNAME");
            if (string.IsNullOrEmpty(mailPass)) mailPass = Environment.GetEnvironmentVariable("EMAIL_PASSWORD");
            if (string.IsNullOrEmpty(mailHost)) mailHost = Environment.GetEnvironmentVariable("EMAIL_HOST");
            if (string.IsNullOrEmpty(mailPort)) mailPort = Environment.GetEnvironmentVariable("EMAIL_PORT");

            if (!int.TryParse(mailPort, out int port)) port = 465; // <--- Cambiamos el default a 465 por seguridad

            var email = new MimeMessage();
            email.From.Add(MailboxAddress.Parse(mailUser));
            email.To.Add(MailboxAddress.Parse(toEmail));
            email.Subject = subject;

            var builder = new BodyBuilder();
            builder.HtmlBody = body;
            email.Body = builder.ToMessageBody();

            using var smtp = new SmtpClient();
            try
            {
                // 1. Aumentamos el Timeout a 20 segundos
                smtp.Timeout = 20000;

                // 2. EVITA TIMEOUTS EN RENDER: No verificar revocación de certificados
                smtp.CheckCertificateRevocation = false;

                // 3. Selección inteligente de seguridad según el puerto
                if (port == 465)
                {
                    // Puerto 465 usa SSL directo (Más estable en Render)
                    await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.SslOnConnect);
                }
                else
                {
                    // Puerto 587 usa StartTls
                    await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.StartTls);
                }

                await smtp.AuthenticateAsync(mailUser, mailPass);
                await smtp.SendAsync(email);
                await smtp.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> Error MailKit ({ex.GetType().Name}): {ex.Message}");
                throw;
            }
        }
    }
}