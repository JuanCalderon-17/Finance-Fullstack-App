import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';

import { authGuard } from './auth.guard';
import { provideTestingDependencies } from '../../../testing/test-providers';

describe('authGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
      TestBed.runInInjectionContext(() => authGuard(...guardParameters));

  const run = () => executeGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot);

  /** Builds a JWT-shaped token whose payload expires `secondsFromNow` from now. */
  const tokenExpiringIn = (secondsFromNow: number): string => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + secondsFromNow }));
    return `header.${payload}.signature`;
  };

  let router: Router;

  beforeEach(() => {
    localStorage.removeItem('user');
    TestBed.configureTestingModule({ providers: [provideTestingDependencies()] });
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  afterEach(() => {
    localStorage.removeItem('user');
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });

  it('lets a user with a valid token through', () => {
    localStorage.setItem('user', JSON.stringify({ token: tokenExpiringIn(3600) }));

    expect(run()).toBeTrue();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('sends an anonymous visitor to the login page', () => {
    expect(run()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('blocks an expired session instead of loading a dashboard full of 401s', () => {
    localStorage.setItem('user', JSON.stringify({ token: tokenExpiringIn(-60) }));

    expect(run()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('clears the dead session so the app does not retry it', () => {
    localStorage.setItem('user', JSON.stringify({ token: tokenExpiringIn(-60) }));

    run();

    expect(localStorage.getItem('user')).toBeNull();
  });

  it('treats an unreadable token as invalid', () => {
    localStorage.setItem('user', JSON.stringify({ token: 'not-a-jwt' }));

    expect(run()).toBeFalse();
  });

  it('treats corrupt stored JSON as not logged in', () => {
    localStorage.setItem('user', '{ this is not json');

    expect(run()).toBeFalse();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('rejects a stored user that has no token at all', () => {
    localStorage.setItem('user', JSON.stringify({ email: 'a@b.com' }));

    expect(run()).toBeFalse();
  });
});
