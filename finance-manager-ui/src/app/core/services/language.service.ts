import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root'
})

export class LanguageService{ 
    constructor(private translate: TranslateService) {
        this.translate.addLangs(['en', 'es', 'pt']);
        this.translate.setDefaultLang('es');

        // idioma guardado > idioma del navegador (si es soportado) > español
        const savedLang = localStorage.getItem('app-language');
        const browserLang = this.translate.getBrowserLang();
        const lang = savedLang
            || (browserLang && ['en', 'es', 'pt'].includes(browserLang) ? browserLang : 'es');
        this.setLanguage(lang);
    }

    setLanguage(lang: string): void {
        this.translate.use(lang);

        //guardar en localstorage
        localStorage.setItem('app-language', lang);
    }

    getCurrentLanguage(): string {
    return this.translate.currentLang || 'es';
    }

    getAvailableLanguages() {
    return [
      { code: 'en', name: 'English', flag: '🇺🇸' },
      { code: 'es', name: 'Español', flag: '🇪🇸' },
      { code: 'pt', name: 'Português', flag: '🇧🇷' }
    ];
  }
}
    