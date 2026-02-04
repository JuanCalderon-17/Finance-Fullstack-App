import { Injectable } from '@angular/core'
import { TranslateService } from '@ngx-translate/core';

@Injectable({
    providedIn: 'root'
})

export class LanguageService{ 
    constructor(private translate: TranslateService) {
        this.translate.addLangs(['en', 'es', 'pt']);

        //conseguimos el lenguage deseado desde el localstorage del navegador
        const savedLang = localStorage.getItem('app-language') || 'es';
        this.setLanguage(savedLang);
    }

    setLanguage(lang: string): void {
        this.translate.use(lang);
        
        //guardar en localstorage
         localStorage.setItem('app-language', lang);
        console.log(`🌐 Idioma cambiado a: ${lang}`);
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
    