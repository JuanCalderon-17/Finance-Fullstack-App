import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'finance-manager-ui';
  constructor(private themeService: ThemeService, private translate: TranslateService) {
    this.translate.setDefaultLang('en');

  }


  ngOnInit(): void {
    this.themeService.loadTheme(); // Cargar el tema guardado al iniciar la app

  }
}