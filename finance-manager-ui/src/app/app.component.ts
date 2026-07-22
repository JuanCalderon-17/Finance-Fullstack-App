import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet, Router, RouterLinkActive, NavigationEnd } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
import { ThemeService } from './services/theme.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from './core/services/language.service';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  // 👇 2. AGREGAR TranslateModule AQUÍ (Importante para que funcione el HTML)
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule, TranslateModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'finance-manager-ui';
  showMenu: boolean = true;

  // LanguageService se auto-inicializa al construirse (lee 'app-language' del
  // localStorage); inyectarlo aquí garantiza que corre en TODAS las rutas,
  // incluidas las de auth que no lo inyectan por su cuenta.
  constructor(
    private themeService: ThemeService,
    private languageService: LanguageService,
    private router: Router,
    private titleService: Title,
    private metaService: Meta,
    private translate: TranslateService
  ) {
    // Lógica del menú
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {

      const currentUrl = event.urlAfterRedirects || event.url;
      const isLandingPage = currentUrl === '/';
      const isAuthPage = currentUrl.includes('/auth/');

      if (isAuthPage || isLandingPage) {
        this.showMenu = false;
      } else {
        this.showMenu = true;
      }
    });
  }

  ngOnInit(): void {
    this.themeService.loadTheme();

    // Browser tab title + meta description follow the active language.
    this.applyMetadata();
    this.translate.onLangChange.subscribe(() => this.applyMetadata());
  }

  private applyMetadata(): void {
    this.translate.get(['META.TITLE', 'META.DESCRIPTION']).subscribe(t => {
      const title = t['META.TITLE'];
      const description = t['META.DESCRIPTION'];

      // ngx-translate echoes the key back when a translation is missing —
      // keep the index.html defaults in that case instead of showing "META.TITLE".
      if (title && title !== 'META.TITLE') {
        this.titleService.setTitle(title);
      }
      if (description && description !== 'META.DESCRIPTION') {
        this.metaService.updateTag({ name: 'description', content: description });
      }
    });
  }
}