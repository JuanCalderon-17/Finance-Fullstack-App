using FinanceManager.API.DTOs;
using FinanceManager.API.Interfaces;
using System.Text.Json;

namespace FinanceManager.API.Services
{
    public class CurrencyService : ICurrencyService
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<CurrencyService> _logger;
        private const string API_URL = "https://api.exchangerate-api.com/v4/latest/USD";
        private const decimal FALLBACK_BRL_RATE = 5.7m;

        private static ExternalExchangeRateResponse? _cachedRates;
        private static DateTime _lastFetchTime = DateTime.MinValue;
        private static readonly TimeSpan CacheDuration = TimeSpan.FromHours(1);

        public CurrencyService(HttpClient httpClient, ILogger<CurrencyService> logger)
        {
            _httpClient = httpClient;
            _logger = logger;
        }

        public async Task<CurrencyExchangeDto> GetExchangeRateAsync(string targetCurrency)
        {
            try
            {
                if (_cachedRates != null && DateTime.UtcNow - _lastFetchTime < CacheDuration)
                {
                    return CreateSuccessResponse(targetCurrency, _cachedRates);
                }

                var response = await _httpClient.GetAsync(API_URL);

                if (!response.IsSuccessStatusCode)
                {
                    return CreateFallbackResponse(targetCurrency);
                }

                var content = await response.Content.ReadAsStringAsync();
                var apiResponse = JsonSerializer.Deserialize<ExternalExchangeRateResponse>(
                    content,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (apiResponse?.Rates == null || !apiResponse.Rates.ContainsKey(targetCurrency))
                {
                    return CreateFallbackResponse(targetCurrency);
                }

                _cachedRates = apiResponse;
                _lastFetchTime = DateTime.UtcNow;

                return CreateSuccessResponse(targetCurrency, apiResponse);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener tasa de cambio");
                return CreateFallbackResponse(targetCurrency);
            }
        }

        public async Task<Dictionary<string, decimal>> GetAllRatesAsync()
        {
            try
            {
                if (_cachedRates != null && DateTime.UtcNow - _lastFetchTime < CacheDuration)
                {
                    return _cachedRates.Rates;
                }

                var response = await _httpClient.GetAsync(API_URL);
                response.EnsureSuccessStatusCode();

                var content = await response.Content.ReadAsStringAsync();
                var apiResponse = JsonSerializer.Deserialize<ExternalExchangeRateResponse>(
                    content,
                    new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (apiResponse?.Rates != null)
                {
                    _cachedRates = apiResponse;
                    _lastFetchTime = DateTime.UtcNow;
                    return apiResponse.Rates;
                }

                return new Dictionary<string, decimal>();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener todas las tasas");
                return new Dictionary<string, decimal> { { "BRL", FALLBACK_BRL_RATE } };
            }
        }

        private CurrencyExchangeDto CreateSuccessResponse(string targetCurrency, ExternalExchangeRateResponse apiResponse)
        {
            return new CurrencyExchangeDto
            {
                From = "USD",
                To = targetCurrency,
                ExchangeRate = apiResponse.Rates[targetCurrency],
                UpdatedAt = DateTime.UtcNow,
                IsSuccess = true
            };
        }

        private CurrencyExchangeDto CreateFallbackResponse(string targetCurrency)
        {
            var fallbackRate = targetCurrency == "BRL" ? FALLBACK_BRL_RATE : 1.0m;

            return new CurrencyExchangeDto
            {
                From = "USD",
                To = targetCurrency,
                ExchangeRate = fallbackRate,
                UpdatedAt = DateTime.UtcNow,
                IsSuccess = false,
                ErrorMessage = "Using fallback rate"
            };
        }
    }
}