# AI providers — swapping the chat assistant model

The chat assistant talks to whatever provider implements `IAiService`
(`Services/IAiService.cs`). Nothing else in the app depends on the provider —
the `ChatController` builds a neutral `AiChatContext` and streams whatever the
service yields.

## Current default: Gemini (free tier)

- Implementation: `Services/GeminiAiService.cs`
- Registered in `Program.cs`: `builder.Services.AddHttpClient<IAiService, GeminiAiService>();`
- Config (`appsettings.json` → `Ai`): `Provider`, `Model` (`gemini-flash-latest`), `ApiKey`.
- `gemini-flash-latest` is a self-updating alias — Google retires older ids
  (e.g. `gemini-2.5-flash` is already blocked for new accounts and returns 404).
  Pin an explicit id such as `gemini-3.6-flash` if you need reproducible behaviour.
  To see what your key can actually use:
  `curl "https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY"`
- Key resolution: `GEMINI_API_KEY` env var first, then `Ai:ApiKey`.
- Local setup: `dotnet user-secrets set "Ai:ApiKey" "<your Gemini key>"`.
- Get a key: https://aistudio.google.com/apikey

> ⚠️ Privacy: the Gemini **free tier may use submitted data to improve Google's
> products**. For a finance app with real user data, move to a paid tier or to
> Claude (below) once there are paying users — neither trains on your data.

## Switching to Claude (Anthropic) — plug-and-play

Two steps: add an implementation class, then change one line in `Program.cs`.

### 1. Add `Services/AnthropicAiService.cs`

Mirrors `GeminiAiService` but hits the Anthropic Messages API with `stream: true`.
Uses the same `HttpClient` injection pattern (raw HTTP, like `EmailService`).
The official `Anthropic` NuGet SDK is an alternative if you prefer typed calls.

```csharp
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;

namespace FinanceManager.API.Services
{
    public class AnthropicAiService : IAiService
    {
        private readonly HttpClient _http;
        private readonly IConfiguration _config;
        private readonly ILogger<AnthropicAiService> _logger;

        public AnthropicAiService(HttpClient http, IConfiguration config, ILogger<AnthropicAiService> logger)
        {
            _http = http;
            _config = config;
            _logger = logger;
        }

        public async IAsyncEnumerable<string> StreamReplyAsync(
            AiChatContext context,
            [EnumeratorCancellation] CancellationToken ct = default)
        {
            var apiKey = Environment.GetEnvironmentVariable("ANTHROPIC_API_KEY")
                         ?? _config["Ai:ApiKey"];
            if (string.IsNullOrEmpty(apiKey))
                throw new InvalidOperationException("Anthropic API key not configured.");

            var model = _config["Ai:Model"] ?? "claude-haiku-4-5";

            var messages = new List<object>();
            foreach (var turn in context.History)
            {
                var role = turn.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase) ? "assistant" : "user";
                messages.Add(new { role, content = turn.Content });
            }
            messages.Add(new { role = "user", content = context.UserMessage });

            var body = new
            {
                model,
                max_tokens = 1024,
                system = context.SystemPrompt,
                stream = true,
                messages
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.anthropic.com/v1/messages")
            {
                Content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json")
            };
            request.Headers.Add("x-api-key", apiKey);
            request.Headers.Add("anthropic-version", "2023-06-01");

            using var response = await _http.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                var err = await response.Content.ReadAsStringAsync(ct);
                _logger.LogError("Anthropic error {Status}: {Body}", response.StatusCode, err);
                throw new Exception($"Anthropic error: {response.StatusCode}");
            }

            await using var stream = await response.Content.ReadAsStreamAsync(ct);
            using var reader = new StreamReader(stream);

            // Anthropic SSE: text arrives on content_block_delta events at delta.text
            while (!reader.EndOfStream)
            {
                ct.ThrowIfCancellationRequested();
                var line = await reader.ReadLineAsync(ct);
                if (string.IsNullOrWhiteSpace(line) || !line.StartsWith("data:")) continue;

                var json = line.Substring("data:".Length).Trim();
                if (json == "[DONE]") break;

                string? text = null;
                try
                {
                    using var doc = JsonDocument.Parse(json);
                    var root = doc.RootElement;
                    if (root.TryGetProperty("type", out var type)
                        && type.GetString() == "content_block_delta"
                        && root.TryGetProperty("delta", out var delta)
                        && delta.TryGetProperty("text", out var t))
                    {
                        text = t.GetString();
                    }
                }
                catch (JsonException) { }

                if (!string.IsNullOrEmpty(text)) yield return text;
            }
        }
    }
}
```

### 2. Register it in `Program.cs`

Replace the Gemini registration:

```csharp
// builder.Services.AddHttpClient<IAiService, GeminiAiService>();   // remove
builder.Services.AddHttpClient<IAiService, AnthropicAiService>();    // add
```

### 3. Config

Set the key and model (env var wins over `appsettings.json`):

```
ANTHROPIC_API_KEY = sk-ant-...
Ai:Model          = claude-haiku-4-5   (or claude-sonnet-5 for higher quality)
```

That's the entire swap — the controller, streaming, and the whole Angular
frontend stay untouched.
