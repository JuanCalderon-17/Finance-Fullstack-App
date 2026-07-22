import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface InsightsResponse {
  insights: string[];
  trendComment: string;
  generatedAt: string;
}

interface CachedInsights {
  date: string;      // YYYY-MM-DD
  language: string;
  insights: string[];
  trendComment: string;
}

const INSIGHTS_CACHE_KEY = 'ai-insights';

// Streams the assistant reply over SSE. Uses fetch + ReadableStream (not
// HttpClient) so we can consume a streaming response; because that bypasses
// the jwtInterceptor, we attach the Bearer token manually from localStorage.
@Injectable({ providedIn: 'root' })
export class ChatService {
  private apiUrl = environment.apiUrl + 'chat/stream';
  private insightsUrl = environment.apiUrl + 'chat/insights';

  constructor(private http: HttpClient) {}

  // Dashboard insights. Plain HttpClient (not streaming), so the jwtInterceptor
  // attaches the token automatically.
  getInsights(language: string): Observable<InsightsResponse> {
    return this.http.get<InsightsResponse>(this.insightsUrl, { params: { language } });
  }

  // Returns today's cached insights for this language, or null if the cache is
  // stale/absent. Keeps us off the AI quota on every dashboard load.
  getCachedInsights(language: string): { insights: string[]; trendComment: string } | null {
    try {
      const raw = localStorage.getItem(INSIGHTS_CACHE_KEY);
      if (!raw) return null;
      const cached: CachedInsights = JSON.parse(raw);
      if (cached.date !== this.today() || cached.language !== language) return null;
      if (!cached.insights) return null;
      return { insights: cached.insights, trendComment: cached.trendComment ?? '' };
    } catch {
      return null;
    }
  }

  cacheInsights(language: string, insights: string[], trendComment: string): void {
    try {
      const payload: CachedInsights = { date: this.today(), language, insights, trendComment };
      localStorage.setItem(INSIGHTS_CACHE_KEY, JSON.stringify(payload));
    } catch {
      // storage full / disabled — caching is best-effort
    }
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  async *streamReply(
    message: string,
    history: ChatTurn[],
    language: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    const token = this.getToken();

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ message, history, language }),
      signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`Chat request failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);

        const parsed = this.parseEvent(rawEvent);
        if (!parsed) continue;
        if (parsed.event === 'error') throw new Error('ai_error');
        if (parsed.event === 'done') return;
        if (parsed.data && typeof parsed.data.text === 'string') {
          yield parsed.data.text as string;
        }
      }
    }
  }

  private parseEvent(raw: string): { event: string | null; data: any } | null {
    let eventName: string | null = null;
    let dataStr = '';
    for (const line of raw.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice('event:'.length).trim();
      else if (line.startsWith('data:')) dataStr += line.slice('data:'.length).trim();
    }
    let data: any = null;
    if (dataStr) {
      try {
        data = JSON.parse(dataStr);
      } catch {
        data = null;
      }
    }
    return { event: eventName, data };
  }

  private getToken(): string | null {
    try {
      const user = localStorage.getItem('user');
      if (!user) return null;
      return JSON.parse(user)?.token ?? null;
    } catch {
      return null;
    }
  }
}
