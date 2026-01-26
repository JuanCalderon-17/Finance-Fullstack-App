namespace FinanceManager.API.DTOs
{
    public class ExternalExchangeRateResponse
    {
        public string Base { get; set; } = string.Empty;
        public string Date { get; set; } = string.Empty;
        public Dictionary<string, decimal> Rates { get; set; } = new();
    }

    public class CurrencyExchangeDto
    {
        public string From { get; set; } = "USD";
        public string To { get; set; } = string.Empty;
        public decimal ExchangeRate { get; set; }
        public DateTime UpdatedAt { get; set; }
        public bool IsSuccess { get; set; }
        public string? ErrorMessage { get; set; }
    }
}