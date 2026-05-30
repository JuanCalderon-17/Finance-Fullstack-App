import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserState {
  username: string;
  fullName: string;
  email: string;
  profilePictureUrl: string | null;
}

/**
 * Single source of truth for the logged-in user's display info.
 * Mirrors CurrencyStateService: a BehaviorSubject backed by localStorage so
 * the shell avatars update live when the profile is edited.
 */
@Injectable({ providedIn: 'root' })
export class UserStateService {
  private readonly subject = new BehaviorSubject<UserState>(this.read());
  public user$ = this.subject.asObservable();

  private read(): UserState {
    const raw = localStorage.getItem('user');
    if (raw) {
      try {
        const u = JSON.parse(raw);
        return {
          username: u.username || '',
          fullName: u.fullName || '',
          email: u.username || '',
          profilePictureUrl: u.profilePictureUrl || null
        };
      } catch { /* fall through */ }
    }
    return { username: '', fullName: '', email: '', profilePictureUrl: null };
  }

  /** Re-read from localStorage and broadcast (call after login). */
  refreshFromStorage(): void {
    this.subject.next(this.read());
  }

  /** Merge updated profile fields into localStorage and broadcast to subscribers. */
  setProfile(fullName: string, profilePictureUrl: string | null, token?: string): void {
    const raw = localStorage.getItem('user');
    const stored = raw ? JSON.parse(raw) : {};
    const merged = { ...stored, fullName, profilePictureUrl, token: token ?? stored.token };
    localStorage.setItem('user', JSON.stringify(merged));
    this.subject.next(this.read());
  }
}
