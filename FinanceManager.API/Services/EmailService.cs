using SendGrid;
using SendGrid.Helpers.Mail;
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
            // Lee la API Key desde variables de entorno
            var apiKey = Environment.GetEnvironmentVariable("SENDGRID_API_KEY")
                        ?? _config["SendGrid:ApiKey"];

            var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM")
                           ?? _config["SendGrid:FromEmail"]
                           ?? "noreply@financemanager.com";

            var fromName = Environment.GetEnvironmentVariable("EMAIL_FROM_NAME")
                          ?? _config["SendGrid:FromName"]
                          ?? "Finance Manager";

            if (string.IsNullOrEmpty(apiKey))
            {
                throw new InvalidOperationException("SendGrid API Key no configurada");
            }

            try
            {
                Console.WriteLine("--> [DEBUG] Usando SendGrid API REST");
                Console.WriteLine($"--> [DEBUG] Enviando desde: {fromName} <{fromEmail}>");
                Console.WriteLine($"--> [DEBUG] Destinatario: {toEmail}");

                var client = new SendGridClient(apiKey);

                var from = new EmailAddress(fromEmail, fromName);
                var to = new EmailAddress(toEmail);

                var msg = MailHelper.CreateSingleEmail(from, to, subject, "", body);

                Console.WriteLine("--> [DEBUG] Enviando email vía SendGrid API...");
                var response = await client.SendEmailAsync(msg);

                if (response.IsSuccessStatusCode)
                {
                    Console.WriteLine($"--> [ÉXITO] Email enviado correctamente (Status: {response.StatusCode})");
                }
                else
                {
                    var errorBody = await response.Body.ReadAsStringAsync();
                    Console.WriteLine($"--> [ERROR] SendGrid respondió con error: {response.StatusCode}");
                    Console.WriteLine($"--> [ERROR BODY] {errorBody}");
                    throw new Exception($"SendGrid error: {response.StatusCode} - {errorBody}");
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"--> [ERROR FATAL] {ex.Message}");
                throw new Exception($"No se pudo enviar el correo: {ex.Message}", ex);
            }
        }
    }
}