import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ChatService, ChatTurn } from '../../core/services/chat.service';
import { LanguageService } from '../../core/services/language.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './assistant.component.html',
  styleUrls: ['./assistant.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AssistantComponent {
  messages: ChatMessage[] = [];
  input = '';
  loading = false;
  errored = false;

  @ViewChild('scrollAnchor') scrollAnchor?: ElementRef<HTMLDivElement>;

  constructor(
    private chat: ChatService,
    private language: LanguageService,
    private cdr: ChangeDetectorRef
  ) {}

  /**
   * Minimal, safe Markdown → HTML for assistant replies (bold, italic, bullet
   * lists, line breaks). HTML is escaped first so nothing from the model is
   * ever injected as markup; Angular's [innerHTML] sanitizer is a second layer.
   * A full Markdown library would be overkill for these short chat answers.
   */
  renderMarkdown(raw: string): string {
    const escaped = raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const inline = (s: string): string =>
      s
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') // **bold** first
        .replace(/\*([^*]+?)\*/g, '<em>$1</em>');         // then *italic*

    const out: string[] = [];
    let inList = false;

    for (const line of escaped.split('\n')) {
      const bullet = line.match(/^\s*[*-]\s+(.*)$/);
      if (bullet) {
        if (!inList) { out.push('<ul>'); inList = true; }
        out.push(`<li>${inline(bullet[1])}</li>`);
        continue;
      }
      if (inList) { out.push('</ul>'); inList = false; }
      out.push(line.trim() === '' ? '<br>' : `${inline(line)}<br>`);
    }
    if (inList) out.push('</ul>');

    return out.join('');
  }

  async send(): Promise<void> {
    const text = this.input.trim();
    if (!text || this.loading) return;

    this.errored = false;
    this.messages.push({ role: 'user', content: text });
    this.input = '';

    // History = everything before the message we just added; the backend
    // appends the new user message itself.
    const history: ChatTurn[] = this.messages
      .slice(0, -1)
      .map(m => ({ role: m.role, content: m.content }));

    const assistantMsg: ChatMessage = { role: 'assistant', content: '' };
    this.messages.push(assistantMsg);
    this.loading = true;
    this.cdr.markForCheck();
    this.scrollToBottom();

    try {
      const lang = this.language.getCurrentLanguage();
      for await (const chunk of this.chat.streamReply(text, history, lang)) {
        assistantMsg.content += chunk;
        this.cdr.markForCheck();
        this.scrollToBottom();
      }
    } catch {
      this.errored = true;
      if (!assistantMsg.content) {
        this.messages.pop(); // drop the empty assistant bubble
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
      this.scrollToBottom();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    // Enter sends; Shift+Enter inserts a newline.
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    // Defer so the DOM has rendered the newest content first.
    setTimeout(() => {
      this.scrollAnchor?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
  }
}
