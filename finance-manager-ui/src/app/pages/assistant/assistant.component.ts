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
