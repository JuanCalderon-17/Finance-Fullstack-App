using Microsoft.AspNetCore.Mvc;
using FinanceManager.API.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;

namespace FinanceManager.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CurrencyController : ControllerBase
    {
        private readonly ICurrencyService _currencyService;
        private readonly ILogger<CurrencyController> _logger;

        public CurrencyController(ICurrencyService currencyService, ILogger<CurrencyController> logger)
        {
            _currencyService = currencyService;
            _logger = logger;
        }

        [HttpGet("rate/{targetCurrency}")]
        [AllowAnonymous]
        [EnableRateLimiting("currency")]
        public async Task<IActionResult> GetExchangeRate(string targetCurrency)
        {
            if (string.IsNullOrWhiteSpace(targetCurrency))
            {
                return BadRequest(new { error = "Target currency is required" });
            }

            targetCurrency = targetCurrency.ToUpperInvariant();

            try
            {
                var result = await _currencyService.GetExchangeRateAsync(targetCurrency);

                if (!result.IsSuccess)
                {
                    _logger.LogWarning("Returning fallback rate for {Currency}", targetCurrency);
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetExchangeRate for {Currency}", targetCurrency);
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet("rates")]
        [AllowAnonymous]
        [EnableRateLimiting("currency")]
        public async Task<IActionResult> GetAllRates()
        {
            try
            {
                var rates = await _currencyService.GetAllRatesAsync();
                return Ok(new
                {
                    base_currency = "USD",
                    rates = rates,
                    timestamp = DateTime.UtcNow
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in GetAllRates");
                return StatusCode(500, new { error = "Internal server error" });
            }
        }

        [HttpGet("test")]
        [AllowAnonymous]
        public IActionResult Test()
        {
            return Ok(new
            {
                message = "Currency API is working!",
                timestamp = DateTime.UtcNow
            });
        }
    }
}