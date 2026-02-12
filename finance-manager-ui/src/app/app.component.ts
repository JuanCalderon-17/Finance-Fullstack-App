import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet, Router, RouterLinkActive, NavigationEnd } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { TranslateService, TranslateModule } from '@ngx-translate/core'; 
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

  constructor(private themeService: ThemeService, private translate: TranslateService, private router: Router) {
    // Configuración inicial del idioma
    this.translate.addLangs(['en', 'es', 'pt']); // Opcional: define qué idiomas tienes
    this.translate.setDefaultLang('en');

    // Intentar recuperar el idioma guardado, o usar el del navegador, o default 'en'
    const savedLang = localStorage.getItem('language');
    const browserLang = this.translate.getBrowserLang();
    const langToUse = savedLang || (browserLang?.match(/en|es|pt/) ? browserLang : 'en');
    
    this.translate.use(langToUse); // Usar el idioma decidido
    
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
  }
}