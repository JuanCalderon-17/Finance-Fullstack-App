namespace FinanceManager.API.Services
{
    // Provider-agnostic contract for the chat assistant. Swapping providers
    // (Gemini <-> Claude <-> etc.) means registering a different implementation
    // in Program.cs — nothing else in the app changes.
    public interface IAiService
    {
        // Streams the assistant reply fragment by fragment as they arrive.
        IAsyncEnumerable<string> StreamReplyAsync(AiChatContext context, CancellationToken ct = default);
    }

    // Neutral request the controller builds; each provider maps it to its own wire format.
    public class AiChatContext
    {
        public string SystemPrompt { get; set; } = string.Empty;
        public List<AiTurn> History { get; set; } = new();
        public string UserMessage { get; set; } = string.Empty;
    }

    public class AiTurn
    {
        // "user" or "assistant"
        public string Role { get; set; } = "user";
        public string Content { get; set; } = string.Empty;
    }
}
