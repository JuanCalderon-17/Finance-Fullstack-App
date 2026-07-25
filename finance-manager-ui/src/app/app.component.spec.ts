import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AppComponent } from './app.component';
import { provideTestingDependencies } from '../testing/test-providers';

@Component({ standalone: true, template: '' })
class BlankComponent {}

describe('AppComponent', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideTestingDependencies([
          { path: '', component: BlankComponent },
          { path: 'auth/login', component: BlankComponent },
          { path: 'dashboard', component: BlankComponent }
        ])
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('should create the app', () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;

    expect(app).toBeTruthy();
  });

  it(`should have the 'finance-manager-ui' title`, () => {
    const app = TestBed.createComponent(AppComponent).componentInstance;

    expect(app.title).toEqual('finance-manager-ui');
  });

  describe('bottom navigation', () => {
    it('is hidden on the public landing page', async () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      await router.navigateByUrl('/');
      fixture.detectChanges();

      expect(fixture.componentInstance.showMenu).toBeFalse();
      expect(fixture.nativeElement.querySelector('.bottom-nav-container')).toBeNull();
    });

    it('is hidden on auth pages', async () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      await router.navigateByUrl('/auth/login');
      fixture.detectChanges();

      expect(fixture.componentInstance.showMenu).toBeFalse();
    });

    it('is shown once the user is inside the app', async () => {
      const fixture = TestBed.createComponent(AppComponent);
      fixture.detectChanges();

      await router.navigateByUrl('/dashboard');
      fixture.detectChanges();

      expect(fixture.componentInstance.showMenu).toBeTrue();
      expect(fixture.nativeElement.querySelector('.bottom-nav-container')).not.toBeNull();
    });
  });
});
