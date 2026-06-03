namespace FinanceManager.API.Services
{
    public class EmailService : IEmailService
    {
        private readonly IConfiguration _config;
        private readonly HttpClient _http;

        public EmailService(IConfiguration configuration, HttpClient http)
        {
            _config = configuration;
            _http = http;
        }

        public async Task SendEmailAsync(string toEmail, string subject, string body)
        {
            var apiKey = Environment.GetEnvironmentVariable("RESEND_API_KEY")
                         ?? _config["Resend:ApiKey"];

            var fromEmail = Environment.GetEnvironmentVariable("EMAIL_FROM")
                            ?? _config["Resend:FromEmail"]
                            ?? "onboarding@resend.dev";

            var fromName = Environment.GetEnvironmentVariable("EMAIL_FROM_NAME")
                           ?? _config["Resend:FromName"]
                           ?? "Finance Manager";

            if (string.IsNullOrEmpty(apiKey))
                throw new InvalidOperationException("Resend API key not configured");

            Console.WriteLine($"--> [DEBUG] Resend: sending from {fromName} <{fromEmail}> to {toEmail}");

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            request.Headers.Add("Authorization", $"Bearer {apiKey}");
            request.Content = JsonContent.Create(new
            {
                from = $"{fromName} <{fromEmail}>",
                to = new[] { toEmail },
                subject,
                html = body
            });

            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync();
                Console.WriteLine($"--> [ERROR] Resend {response.StatusCode}: {errorBody}");
                throw new Exception($"Resend error: {response.StatusCode} - {errorBody}");
            }

            Console.WriteLine($"--> [OK] Resend accepted (Status: {response.StatusCode})");
        }
    }
}
