import { Component, OnInit, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { ThemeToggleComponent } from '../../shared/theme-toggle/theme-toggle.component';
import { LanguageService } from '../../core/services/language.service';
import { CurrencyService } from '../../core/services/currency.service';
import { CurrencyStateService } from '../../core/services/currency-state.service';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, TranslateModule, ThemeToggleComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent implements OnInit {
  username: string = '';
  greeting: string = '';
  currencyCode: string = 'USD';
  currencySymbol: string = '$';
  showLangMenu = false;
  showCurrencyMenu = false;
  sidebarCollapsed = false;

  constructor(
    public languageService: LanguageService,
    private currencyService: CurrencyService,
    private currencyStateService: CurrencyStateService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const user = JSON.parse(raw);
        const firstName = user.fullName?.trim().split(/\s+/)[0];
        this.username = firstName || user.username || user.email?.split('@')[0] || 'there';
      } catch {
        this.username = 'there';
      }
    }

    const hour = new Date().getHours();
    if (hour < 12) this.greeting = 'Good Morning';
    else if (hour < 18) this.greeting = 'Good Afternoon';
    else this.greeting = 'Good Evening';

    this.currencyStateService.currency$.subscribe(c => {
      this.currencyCode = c.code;
      this.currencySymbol = c.symbol;
    });
  }

  toggleLangMenu(event: Event): void {
    event.stopPropagation();
    this.showLangMenu = !this.showLangMenu;
    this.showCurrencyMenu = false;
  }

  toggleCurrencyMenu(event: Event): void {
    event.stopPropagation();
    this.showCurrencyMenu = !this.showCurrencyMenu;
    this.showLangMenu = false;
  }

  selectLanguage(lang: string, event: Event): void {
    event.stopPropagation();
    this.languageService.setLanguage(lang);
    this.showLangMenu = false;
  }

  selectCurrency(code: string, event: Event): void {
    event.stopPropagation();
    const symbol = code === 'BRL' ? 'R$' : '$';
    this.currencyService.getExchangeRate('BRL').subscribe({
      next: rate => this.currencyStateService.setCurrency(code, symbol, rate),
      error: ()  => this.currencyStateService.setCurrency(code, symbol, 5.25)
    });
    this.showCurrencyMenu = false;
  }

  logout(): void {
    localStorage.removeItem('user');
    this.router.navigate(['/auth/login']);
  }

  get userInitial(): string {
    return this.username ? this.username.charAt(0).toUpperCase() : 'U';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.lang-item')) this.showLangMenu = false;
    if (!target.closest('.currency-item') && !target.closest('.topbar-currency-pill')) this.showCurrencyMenu = false;
  }
}
