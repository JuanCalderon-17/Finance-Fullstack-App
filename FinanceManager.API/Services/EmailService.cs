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

            // Fallback a variables de entorno
            if (string.IsNullOrEmpty(mailUser)) mailUser = Environment.GetEnvironmentVariable("EMAIL_USERNAME");
            if (string.IsNullOrEmpty(mailPass)) mailPass = Environment.GetEnvironmentVariable("EMAIL_PASSWORD");
            if (string.IsNullOrEmpty(mailHost)) mailHost = Environment.GetEnvironmentVariable("EMAIL_HOST");
            if (string.IsNullOrEmpty(mailPort)) mailPort = Environment.GetEnvironmentVariable("EMAIL_PORT");

            // Si falla el parseo, forzamos 465
            if (!int.TryParse(mailPort, out int port)) port = 465;

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
                // --- LOGS DE DEPURACIÓN (Míralos en Render si falla) ---
                Console.WriteLine($"--> [DEBUG] Host: {mailHost}");
                Console.WriteLine($"--> [DEBUG] Port: {port} (Si dice 587, cambia la Variable de Entorno a 465)");
                Console.WriteLine($"--> [DEBUG] Usuario: {mailUser}");

                // Timeout de 20 segundos
                smtp.Timeout = 20000;
                smtp.CheckCertificateRevocation = false;

                // LÓGICA MAESTRA:
                // Si el puerto es 465, usamos SSL Implícito (SslOnConnect).
                // Si es 587, usamos StartTls (Pero esto suele fallar en Render).
                if (port == 465)
                {
                    Console.WriteLine("--> [DEBUG] Conectando vía SSL (Puerto 465)...");
                    await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.SslOnConnect);
                }
                else
                {
                    Console.WriteLine("--> [DEBUG] Conectando vía StartTls (Puerto 587)...");
                    await smtp.ConnectAsync(mailHost, port, SecureSocketOptions.StartTls);
                }

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
                // Importante: No lanzamos el error (throw) para que el frontend reciba algo,
                // aunque sea un 200 OK falso, O lanzar una excepción controlada.
                // Por ahora lanzamos para ver el error en Logs.
                throw;
            }
        }
    }
}