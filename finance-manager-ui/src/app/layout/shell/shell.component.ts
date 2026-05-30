import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';
import { LanguageService } from '../../core/services/language.service';
import { CurrencyService } from '../../core/services/currency.service';
import { CurrencyStateService } from '../../core/services/currency-state.service';
import { UserStateService } from '../../core/services/user-state.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, TranslateModule, ThemeToggleComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent implements OnInit {
  username: string = '';
  fullName: string = '';
  email: string = '';
  profilePictureUrl: string | null = null;
  greeting: string = '';
  currencyCode: string = 'USD';
  currencySymbol: string = '$';
  showUserMenu = false;

  constructor(
    public languageService: LanguageService,
    private currencyService: CurrencyService,
    private currencyStateService: CurrencyStateService,
    private userStateService: UserStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Live user info — updates instantly when the profile is edited.
    this.userStateService.user$.subscribe(u => {
      const firstName = u.fullName?.trim().split(/\s+/)[0];
      this.username = firstName || u.username || u.email?.split('@')[0] || 'there';
      this.fullName = u.fullName || '';
      this.email = u.email || '';
      this.profilePictureUrl = u.profilePictureUrl;
    });

    const hour = new Date().getHours();
    if (hour < 12) this.greeting = 'Good Morning';
    else if (hour < 18) this.greeting = 'Good Afternoon';
    else this.greeting = 'Good Evening';

    this.currencyStateService.currency$.subscribe(c => {
      this.currencyCode = c.code;
      this.currencySymbol = c.symbol;
    });
  }

  toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.showUserMenu = !this.showUserMenu;
  }

  selectLanguage(lang: string, event: Event): void {
    event.stopPropagation();
    this.languageService.setLanguage(lang);
    // Keep the menu open so the active segment updates in place.
  }

  selectCurrency(code: string, event: Event): void {
    event.stopPropagation();
    const symbol = code === 'BRL' ? 'R$' : '$';
    this.currencyService.getExchangeRate('BRL').subscribe({
      next: rate => this.currencyStateService.setCurrency(code, symbol, rate),
      error: ()  => this.currencyStateService.setCurrency(code, symbol, 5.25)
    });
    // Keep the menu open so the active segment updates in place.
  }

  logout(): void {
    localStorage.removeItem('user');
    this.router.navigate(['/auth/login']);
  }

  get userInitial(): string {
    return this.username ? this.username.charAt(0).toUpperCase() : 'U';
  }

  // Maps a language code to its local SVG flag (renders identically on every OS).
  private readonly flagFiles: Record<string, string> = { en: 'us', es: 'es', pt: 'br' };
  flagSrc(code: string): string {
    return `assets/flags/${this.flagFiles[code] || code}.svg`;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.topbar-user')) this.showUserMenu = false;
  }
}
