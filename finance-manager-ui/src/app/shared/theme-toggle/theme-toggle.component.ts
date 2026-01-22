import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-theme-toggle',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="theme-toggle-wrapper">
      <span class="theme-label" [class.active]="!isDarkMode">Light</span>
      
      <button 
        class="theme-switch"
        [class.dark]="isDarkMode"
        (click)="toggleTheme()"
        [attr.aria-label]="isDarkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
        title="{{ isDarkMode ? 'Modo Claro' : 'Modo Oscuro' }}">
        
        <span class="switch-slider"></span>
      </button>
      
      <span class="theme-label" [class.active]="isDarkMode">Dark</span>
    </div>
  `,
  styles: [`
    .theme-toggle-wrapper {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .theme-label {
      font-size: 0.875rem;
      font-weight: 600;
      color: rgba(255, 255, 255, 0.5);
      transition: color 0.3s ease;
      user-select: none;
      
      &.active {
        color: rgba(255, 255, 255, 1);
      }
    }

    .theme-switch {
      position: relative;
      width: 48px;
      height: 26px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.3s ease;
      padding: 0;
      overflow: hidden;

      &:hover {
        background: rgba(255, 255, 255, 0.3);
        border-color: rgba(255, 255, 255, 0.4);
        transform: scale(1.05);
      }

      &:active {
        transform: scale(0.98);
      }

      // Modo oscuro activado
      &.dark {
        background: rgba(255, 255, 255, 0.25);
        border-color: rgba(255, 255, 255, 0.4);
      }
    }

    .switch-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: white;
      border-radius: 50%;
      transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);

      .dark & {
        transform: translateX(22px);
        background: white;
      }
    }

    // Variante para modo oscuro del navbar
    [data-theme="dark"] .theme-toggle-wrapper {
      .theme-label {
        color: rgba(255, 255, 255, 0.5);
        
        &.active {
          color: rgba(255, 255, 255, 1);
        }
      }

      .theme-switch {
        background: rgba(255, 255, 255, 0.15);
        border-color: rgba(255, 255, 255, 0.25);

        &:hover {
          background: rgba(255, 255, 255, 0.25);
          border-color: rgba(255, 255, 255, 0.35);
        }
      }
    }

    // Responsive
    @media (max-width: 768px) {
      .theme-label {
        font-size: 0.75rem;
      }

      .theme-switch {
        width: 42px;
        height: 24px;
      }

      .switch-slider {
        width: 16px;
        height: 16px;

        .dark & {
          transform: translateX(18px);
        }
      }
    }
  `]
})
export class ThemeToggleComponent implements OnInit {
  isDarkMode: boolean = false;

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.isDarkMode$.subscribe(isDark => {
      this.isDarkMode = isDark;
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}