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
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      transition: color 0.2s ease;
      user-select: none;

      &.active {
        color: var(--text-primary);
      }
    }

    .theme-switch {
      position: relative;
      width: 44px;
      height: 24px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.2s ease;
      padding: 0;
      overflow: hidden;
      flex-shrink: 0;

      &:hover {
        border-color: var(--border-strong);
      }

      &:active { transform: scale(0.97); }

      &.dark {
        background: var(--color-primary);
        border-color: var(--color-primary);
      }
    }

    .switch-slider {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 18px;
      height: 18px;
      background: #ffffff;
      border-radius: 50%;
      transition: transform 0.25s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);

      .dark & { transform: translateX(20px); }
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