import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  
  isLangMenuOpen: boolean = false;
  
  constructor(public languageService: LanguageService) {}

  toggleLangMenu() { 
    this.isLangMenuOpen = !this.isLangMenuOpen;
  }

  selectLanguage(language: string) {
    this.languageService.setLanguage(language);
    this.isLangMenuOpen = false;
  }
}