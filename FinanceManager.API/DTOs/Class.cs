namespace FinanceManager.API.DTOs
{

    public class ExchangeRateApiResponse
    {
        public string Result { get; set; } = string.Empty;
        public string Base_Code { get; set; } = string.Empty;
        public long Time_Last_Update_Unix { get; set; }
        public Dictionary<string, decimal> Rates { get; set; } = new();
    }


    public class ExchangeRateDto
    {
        public string FromCurrency { get; set; } = "USD";
        public string ToCurrency { get; set; } = string.Empty;
        public decimal Rate { get; set; }
        public DateTime LastUpdate { get; set; }
        public bool Success { get; set; }
        public string? ErrorMessage { get; set; }
    }
}
