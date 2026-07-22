using System.ComponentModel.DataAnnotations;

namespace FinanceManager.API.DTOs
{
    public class ChatRequestDto
    {
        [Required]
        [StringLength(2000)]
        public string Message { get; set; } = string.Empty;

        // Prior turns of the conversation (client-held). Optional.
        public List<ChatTurnDto>? History { get; set; }

        // App UI language: "es" | "en" | "pt". Defaults to "es" server-side.
        public string? Language { get; set; }
    }

    public class ChatTurnDto
    {
        // "user" or "assistant"
        public string Role { get; set; } = "user";
        public string Content { get; set; } = string.Empty;
    }

    public class InsightsResponseDto
    {
        public List<string> Insights { get; set; } = new();

        // One-sentence reading of the cash-flow trend, rendered under the chart.
        // Empty when there isn't enough history to say anything useful.
        public string TrendComment { get; set; } = string.Empty;

        public DateTime GeneratedAt { get; set; }
    }
}
