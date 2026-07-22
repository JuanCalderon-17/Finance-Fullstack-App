using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace FinanceManager.API.Services
{
    // Default IAiService implementation: Google Gemini (free tier).
    // Mirrors the EmailService pattern — HttpClient injected via AddHttpClient,
    // API key read from env var first, config section as fallback.
    // To switch to Claude, register AnthropicAiService in Program.cs instead
    // (same interface). See Services/AnthropicAiService.cs.txt for a template.
    public class GeminiAiService : IAiService
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;
        private readonly ILogger<GeminiAiService> _logger;

        public GeminiAiService(HttpClient http, IConfiguration config, ILogger<GeminiAiService> logger)
        {
            _http = http;
            _config = config;
            _logger = logger;
        }

        public async IAsyncEnumerable<string> StreamReplyAsync(
            AiChatContext context,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            var apiKey = Environment.GetEnvironmentVariable("GEMINI_API_KEY")
                         ?? _config["Ai:ApiKey"];

            if (string.IsNullOrEmpty(apiKey))
                throw new InvalidOperationException("Gemini API key not configured (GEMINI_API_KEY / Ai:ApiKey).");

            // "gemini-flash-latest" is a self-updating alias, so a retired model
            // never 404s this endpoint. Pin an explicit id (e.g. "gemini-3.6-flash")
            // via Ai:Model if you need reproducible behaviour.
            var model = _config["Ai:Model"] ?? "gemini-flash-latest";

            // Gemini uses "user" / "model" roles; we map "assistant" -> "model".
            var contents = new List<object>();
            foreach (var turn in context.History)
            {
                var role = turn.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ? "model" : "user";
                contents.Add(new { role, parts = new[] { new { text = turn.Content } } });
            }
            contents.Add(new { role = "user", parts = new[] { new { text = context.UserMessage } } });

            var body = new
            {
                system_instruction = new { parts = new[] { new { text = context.SystemPrompt } } },
                contents
            };

            var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse&key={apiKey}";

            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };

            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);

            if (!response.IsSuccessStatusCode)
            {
                var errorBody = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Gemini error {Status}: {Body}", response.StatusCode, errorBody);
                throw new Exception($"Gemini error: {response.StatusCode}");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var reader = new StreamReader(stream);

            // Gemini SSE: one "data: {json}" line per chunk; text lives at
            // candidates[0].content.parts[*].text.
            while (!reader.EndOfStream)
            {
                ct.ThrowIfCancellationRequested();

                var line = await reader.ReadLineAsync(ct);
                if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data:"))
                    continue;

                var json = line.Substring("data:".Length).Trim();
                if (json == "[DONE]")
                    break;

                var text = ExtractText(json);
                if (!string.IsNullOrEmpty(text))
                    yield return text;
            }
        }

        // Pulls concatenated text parts out of a single Gemini SSE chunk.
        // Returns null on any malformed/keepalive chunk instead of throwing.
        private string? ExtractText(string json)
        {
            try
            {
                using var doc = JsonDocument.Parse(json);
                if (!doc.RootElement.TryGetProperty("candidates", out var candidates)
                    || candidates.ValueKind != JsonValueKind.Array
                    || candidates.GetArrayLength() == 0)
                    return null;

                var first = candidates[0];
                if (!first.TryGetProperty("content", out var content)
                    || !content.TryGetProperty("parts", out var parts)
                    || parts.ValueKind != JsonValueKind.Array)
                    return null;

                var sb = new StringBuilder();
                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
                        sb.Append(t.GetString());
                }
                return sb.Length > 0 ? sb.ToString() : null;
            }
            catch (JsonException)
            {
                return null;
            }
        }
    }
}
