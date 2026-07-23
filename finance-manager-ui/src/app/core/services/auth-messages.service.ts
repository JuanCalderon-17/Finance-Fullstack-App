import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';

/**
 * Turns the auth endpoints' stable `code` field into a message in the user's
 * active language.
 *
 * The API writes its prose in Spanish, so rendering `error`/`message` straight
 * from the response showed Spanish alerts to EN/PT users. Every auth response
 * also carries a `code` (see AccountController) — we translate that instead and
 * never display the backend text.
 *
 * Resolution is async on purpose: the locale files load over HTTP, and the
 * verify-email screen is opened cold from an email link, so `instant()` would
 * hand back the raw key on a slow connection.
 */
@Injectable({ providedIn: 'root' })
export class AuthMessagesService {

  constructor(private translate: TranslateService) {}

  /** Message for a successful response body, e.g. `{ code: 'VERIFICATION_SENT' }`. */
  fromResponse(res: any, fallbackKey: string): Observable<string> {
    return this.resolve(res?.code, fallbackKey);
  }

  /** Message for an HttpErrorResponse whose body is `{ code: '...' }`. */
  fromError(err: any, fallbackKey: string): Observable<string> {
    return this.resolve(err?.error?.code, fallbackKey);
  }

  private resolve(code: string | undefined | null, fallbackKey: string): Observable<string> {
    if (!code) return this.translate.get(fallbackKey);

    const key = `AUTH.STATUS.${code}`;
    return this.translate.get(key).pipe(
      // ngx-translate echoes the key back when there is no entry for it, which
      // is how an unknown/new backend code lands on the generic message.
      switchMap(value => value === key ? this.translate.get(fallbackKey) : of(value))
    );
  }
}
