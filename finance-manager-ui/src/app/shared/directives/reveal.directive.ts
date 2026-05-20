import {
  Directive,
  ElementRef,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  Renderer2,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

let sharedObserver: IntersectionObserver | null = null;
const registry = new WeakMap<Element, RevealDirective>();

const OBSERVER_THRESHOLD = 0.15;
const OBSERVER_ROOT_MARGIN = '0px 0px -10% 0px';
const VISIBLE_CLASS = 'is-visible';
const BASE_CLASS = 'reveal';

@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements OnInit, OnDestroy {
  /** Optional delay in ms. Overrides --reveal-delay inline custom property. */
  @Input() revealDelay?: number;
  /** If true (default), unobserve after first reveal. Set false to re-animate on re-entry. */
  @Input() revealOnce = true;

  constructor(
    private el: ElementRef<HTMLElement>,
    private renderer: Renderer2,
    @Inject(PLATFORM_ID) private platformId: object,
  ) {}

  ngOnInit(): void {
    const node = this.el.nativeElement;
    this.renderer.addClass(node, BASE_CLASS);

    if (this.revealDelay != null) {
      this.renderer.setStyle(node, '--reveal-delay', `${this.revealDelay}ms`);
    }

    if (!isPlatformBrowser(this.platformId) || typeof IntersectionObserver === 'undefined') {
      this.renderer.addClass(node, VISIBLE_CLASS);
      return;
    }

    this.ensureObserver();
    registry.set(node, this);
    sharedObserver!.observe(node);
  }

  ngOnDestroy(): void {
    const node = this.el.nativeElement;
    sharedObserver?.unobserve(node);
    registry.delete(node);
  }

  onIntersect(isIntersecting: boolean): void {
    const node = this.el.nativeElement;
    if (isIntersecting) {
      this.renderer.addClass(node, VISIBLE_CLASS);
      if (this.revealOnce && sharedObserver) {
        sharedObserver.unobserve(node);
        registry.delete(node);
      }
    } else if (!this.revealOnce) {
      this.renderer.removeClass(node, VISIBLE_CLASS);
    }
  }

  private ensureObserver(): void {
    if (sharedObserver) return;
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          registry.get(entry.target)?.onIntersect(entry.isIntersecting);
        }
      },
      { threshold: OBSERVER_THRESHOLD, rootMargin: OBSERVER_ROOT_MARGIN },
    );
  }
}
