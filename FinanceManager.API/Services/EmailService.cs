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
            var mailUser = Environment.GetEnvironmentVariable("EMAIL_USERNAME")
                          ?? _config["EmailSettings:User"];
            var mailPass = Environment.GetEnvironmentVariable("EMAIL_PASSWORD")
                          ?? _config["EmailSettings:Password"];
            var mailHost = Environment.GetEnvironmentVariable("EMAIL_HOST")
                          ?? _config["EmailSettings:Host"];
            var portStr = Environment.GetEnvironmentVariable("EMAIL_PORT")
                         ?? _config["EmailSettings:Port"]
                         ?? "587";

            if (string.IsNullOrEmpty(mailUser) || string.IsNullOrEmpty(mailPass) || string.IsNullOrEmpty(mailHost))
            {
                throw new InvalidOperationException("Configuración de email incompleta");
            }

            int port = int.Parse(portStr);

            var email = new MimeMessage();
            email.From.Add(MailboxAddress.Parse(mailUser));
            email.To.Add(MailboxAddress.Parse(toEmail));
            email.Subject = subject;

            var builder = new BodyBuilder { HtmlBody = body };
            email.Body = builder.ToMessageBody();

            using var smtp = new SmtpClient();

            try
            {
                Console.WriteLine($"--> [DEBUG] Intentando SendGrid: {mailHost}:{port}");
                Console.WriteLine($"--> [DEBUG] Usuario: {mailUser}");

                // Configuración crítica para evitar timeouts en Render
                smtp.Timeout = 45000; // 45 segundos
                smtp.CheckCertificateRevocation = false;
                smtp.ServerCertificateValidationCallback = (s, c, h, e) => true;

                // Conectar con STARTTLS (puerto 587)
                Console.WriteLine("--> [DEBUG] Conectando con STARTTLS...");
                await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.StartTls);

                Console.WriteLine("--> [DEBUG] Autenticando...");
                await smtp.AuthenticateAsync(mailUser, mailPass);

                Console.WriteLine("--> [DEBUG] Enviando email...");
                await smtp.SendAsync(email);

                Console.WriteLine("--> [ÉXITO] Email enviado correctamente");
                await smtp.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR MAILKIT] Tipo: {ex.GetType().Name}");
                Console.WriteLine($"--> [ERROR MAILKIT] Mensaje: {ex.Message}");
                if (ex.InnerException != null)
                {
                    Console.WriteLine($"--> [INNER ERROR] {ex.InnerException.Message}");
                }
                throw new Exception($"No se pudo enviar el correo: {ex.Message}", ex);
            }
        }
    }
}