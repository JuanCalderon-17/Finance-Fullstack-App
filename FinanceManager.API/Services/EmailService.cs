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

            // Fallback a variables de entorno para usuario/pass/host
            if (string.IsNullOrEmpty(mailUser)) mailUser = Environment.GetEnvironmentVariable("EMAIL_USERNAME");
            if (string.IsNullOrEmpty(mailPass)) mailPass = Environment.GetEnvironmentVariable("EMAIL_PASSWORD");
            if (string.IsNullOrEmpty(mailHost)) mailHost = Environment.GetEnvironmentVariable("EMAIL_HOST");

            // --- CAMBIO NUCLEAR: FORZAMOS PUERTO 465 ---
            // Ignoramos lo que diga Render y forzamos el puerto seguro.
            int port = 465;
            // -------------------------------------------

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
                // --- LOGS DE DEPURACIÓN ---
                Console.WriteLine($"--> [DEBUG] Host: {mailHost}");
                Console.WriteLine($"--> [DEBUG] Port: {port} (FORZADO MANUALMENTE)");
                Console.WriteLine($"--> [DEBUG] Usuario: {mailUser}");

                // Timeout de 20 segundos
                smtp.Timeout = 20000;
                smtp.CheckCertificateRevocation = false;

                // Como forzamos 465, usamos SIEMPRE SslOnConnect
                Console.WriteLine("--> [DEBUG] Conectando vía SSL (Puerto 465)...");
                await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.SslOnConnect);

                Console.WriteLine("--> [DEBUG] Autenticando...");
                await smtp.AuthenticateAsync(mailUser, mailPass);

                Console.WriteLine("--> [DEBUG] Enviando mensaje...");
                await smtp.SendAsync(email);

                Console.WriteLine("--> [EXITO] Correo enviado correctamente.");
                await smtp.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR FATAL] MailKit: {ex.Message}");
                // Lanzamos el error para que el Controller lo capture y lo muestre en el frontend
                throw;
            }
        }
    }
}