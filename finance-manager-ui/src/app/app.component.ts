import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './services/theme.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  title = 'finance-manager-ui';

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    // Cargar el tema guardado al iniciar la app
    this.themeService.loadTheme();
  }
}