using FinanceManager.API.DTOs;

namespace FinanceManager.API.Interfaces
{
    public interface ICurrencyService
    {
        Task<CurrencyExchangeDto> GetExchangeRateAsync(string targetCurrency);
        Task<Dictionary<string, decimal>> GetAllRatesAsync();
    }
}