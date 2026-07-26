import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  HttpHandlerFn,
  HttpRequest,
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { jwtInterceptor } from './jwt.interceptor';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.removeItem('user');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate');
  });

  afterEach(() => {
    localStorage.removeItem('user');
  });

  it('attaches the stored token as a bearer header', () => {
    localStorage.setItem('user', JSON.stringify({ token: 'abc123' }));

    http.get('/api/transactions').subscribe();

    const req = httpMock.expectOne('/api/transactions');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it('sends no Authorization header when nobody is logged in', () => {
    http.get('/api/transactions').subscribe();

    const req = httpMock.expectOne('/api/transactions');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('signs the user out when their own token is rejected', () => {
    localStorage.setItem('user', JSON.stringify({ token: 'expired' }));

    http.get('/api/transactions').subscribe({ error: () => {} });
    httpMock.expectOne('/api/transactions').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(localStorage.getItem('user')).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/auth/login']);
  });

  it('leaves a failed login alone instead of redirecting it', () => {
    // No token was attached, so this 401 is "wrong password", not "session expired".
    // Redirecting here would bounce the user off the login page they are already on.
    http.post('/api/account/login', {}).subscribe({ error: () => {} });
    httpMock.expectOne('/api/account/login').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('passes the error through to the caller after handling a 401', () => {
    localStorage.setItem('user', JSON.stringify({ token: 'expired' }));

    let received: unknown = null;
    http.get('/api/transactions').subscribe({ error: (err) => (received = err) });
    httpMock.expectOne('/api/transactions').flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(received).not.toBeNull();
  });

  it('KNOWN BUG: a corrupt stored user breaks every request in the app', () => {
    // SHOULD BE: unreadable storage is treated as "not logged in" and the request goes
    // out anonymously — which is exactly what authGuard does, it wraps its JSON.parse
    // in a try/catch and clears the bad entry.
    //
    // ACTUALLY IS: the interceptor's JSON.parse is unguarded, so it throws synchronously
    // out of the interceptor chain. Every outgoing HTTP call in the app fails at the
    // same point, and because nothing clears the entry the app stays broken until the
    // user wipes site data by hand. One truncated write to localStorage does it.
    //
    // Invoked directly rather than through HttpClient on purpose: routed through the
    // real client the throw escapes into the zone and takes the whole Karma run down
    // with it, which is itself a fair illustration of the blast radius.
    localStorage.setItem('user', '{ this is not json');

    const request = new HttpRequest('GET', '/api/transactions');
    const next = jasmine.createSpy('next') as jasmine.Spy & HttpHandlerFn;

    expect(() =>
      TestBed.runInInjectionContext(() => jwtInterceptor(request, next))
    ).toThrowError(SyntaxError);

    // The request never even reached the next handler.
    expect(next).not.toHaveBeenCalled();
  });
});
