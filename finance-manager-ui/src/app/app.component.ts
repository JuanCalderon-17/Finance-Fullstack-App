import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet, Router, RouterLinkActive, NavigationEnd } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { filter  } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink,RouterOutlet, CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'finance-manager-ui';
  showMenu:  boolean = true;

  constructor(private themeService: ThemeService, private translate: TranslateService, private router: Router) {
    this.translate.setDefaultLang('en');
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
    this.themeService.loadTheme(); // Cargar el tema guardado al iniciar la app

  }
}