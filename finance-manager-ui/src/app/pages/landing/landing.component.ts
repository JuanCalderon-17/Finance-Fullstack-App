import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, takeUntil } from 'rxjs';
import { animate } from 'motion';
import { LanguageService } from '../../core/services/language.service';

interface FlowPath {
  d: string;
  width: number;
  opacity: number;
  duration: number;
}

interface TitleLetter {
  char: string;
  delay: number;
}

interface TitleWord {
  letters: TitleLetter[];
}

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit, AfterViewInit, OnDestroy {
  private destroy$ = new Subject<void>();

  isLangMenuOpen = false;
  paths1: FlowPath[] = this.generatePaths(1);
  paths2: FlowPath[] = this.generatePaths(-1);
  titleWords: TitleWord[] = [];

  constructor(
    public languageService: LanguageService,
    private translate: TranslateService,
    private host: ElementRef<HTMLElement>
  ) {}

  ngOnInit(): void {
    this.refreshTitle();
    this.translate.onLangChange
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.refreshTitle());
  }

  ngAfterViewInit(): void {
    const paths = this.host.nativeElement.querySelectorAll<SVGPathElement>('.flow-path');
    paths.forEach(path => {
      const duration = 20 + Math.random() * 10;
      animate(
        path,
        {
          pathLength: [0.3, 1],
          pathOffset: [0, 1],
          opacity: [0.3, 0.6, 0.3]
        },
        {
          duration,
          repeat: Infinity,
          ease: 'linear'
        }
      );
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleLangMenu(): void {
    this.isLangMenuOpen = !this.isLangMenuOpen;
  }

  selectLanguage(language: string): void {
    this.languageService.setLanguage(language);
    this.isLangMenuOpen = false;
  }

  private refreshTitle(): void {
    this.translate
      .get(['LANDING.TITLE', 'LANDING.SUBTITLE'])
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => {
        const fullTitle = `${t['LANDING.TITLE']} ${t['LANDING.SUBTITLE']}`.trim();
        this.titleWords = fullTitle.split(' ').map((word, wi) => ({
          letters: word.split('').map((char, li) => ({
            char,
            delay: wi * 0.1 + li * 0.03
          }))
        }));
      });
  }

  private generatePaths(position: number): FlowPath[] {
    return Array.from({ length: 36 }, (_, i) => ({
      d:
        `M-${380 - i * 5 * position} -${189 + i * 6}` +
        `C-${380 - i * 5 * position} -${189 + i * 6} ` +
        `-${312 - i * 5 * position} ${216 - i * 6} ` +
        `${152 - i * 5 * position} ${343 - i * 6}` +
        `C${616 - i * 5 * position} ${470 - i * 6} ` +
        `${684 - i * 5 * position} ${875 - i * 6} ` +
        `${684 - i * 5 * position} ${875 - i * 6}`,
      width: 0.5 + i * 0.03,
      opacity: 0.1 + i * 0.03,
      duration: 30 + Math.random() * 20
    }));
  }
}
