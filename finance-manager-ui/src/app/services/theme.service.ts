import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  // Observable para que los componentes se suscriban
  private isDarkMode = new BehaviorSubject<boolean>(false);
  public isDarkMode$ = this.isDarkMode.asObservable();

  constructor() {
    this.loadTheme();
  }

  /**
   * Carga el tema guardado en localStorage al iniciar la app
   */
  loadTheme(): void {
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark') {
      this.setDarkMode(true);
    } else if (savedTheme === 'light') {
      this.setDarkMode(false);
    } else {
      // Sin preferencia guardada: respetar la preferencia del sistema operativo
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      this.setDarkMode(prefersDark);
    }
  }

  /**
   * Alterna entre modo claro y oscuro
   */
  toggleTheme(): void {
    const newMode = !this.isDarkMode.value;
    this.setDarkMode(newMode);
  }

  /**
   * Establece el modo oscuro o claro
   */
  setDarkMode(isDark: boolean): void {
    this.isDarkMode.next(isDark);
    
    // Aplicar o quitar el atributo data-theme="dark" en el <html>
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  }

  /**
   * Obtiene el estado actual del tema
   */
  getCurrentTheme(): boolean {
    return this.isDarkMode.value;
  }
}