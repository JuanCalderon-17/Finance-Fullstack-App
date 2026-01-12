using System.Net;
using System.Net.Mail; 


namespace FinanceManager.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _configuration;

        public EmailService(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var emailSettings = _configuration.GetSection("EmailSettings");
            var myEmail = emailSettings["Email"];
            var myPassword = emailSettings["Password"];
            var host = emailSettings["Host"];
            var port = int.Parse(emailSettings["Port"]);

            // 2. configuro el cliente SMTP (el cartero)
            var smtpClient = new SmtpClient(host)
            {
                Port = port,
                Credentials = new NetworkCredential(myEmail, myPassword),
                EnableSsl = true,
            };

            // 3. se crea el mensaje de correo
            var mailMessage = new MailMessage
            {
                From = new MailAddress(myEmail),
                Subject = subject,
                Body = body,
                IsBodyHtml = true,
            };

            mailMessage.To.Add(toEmail);

            await smtpClient.SendMailAsync(mailMessage);

        }
        
    }
}
