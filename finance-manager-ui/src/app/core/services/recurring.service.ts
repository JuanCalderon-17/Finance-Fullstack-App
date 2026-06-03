import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

// Matches the backend RecurrenceFrequency enum (serialized as numbers).
export enum RecurrenceFrequency {
  Weekly = 0,
  Biweekly = 1,
  Monthly = 2,
  Yearly = 3
}

export interface RecurringTransaction {
  id?: number;
  description: string;
  amount: number;
  category: string;
  currency: string;
  frequency: RecurrenceFrequency;
  startDate: string;       // ISO date
  endDate?: string | null; // ISO date or null
  nextDueDate?: string;
  isActive?: boolean;
}

export interface DueOccurrence {
  recurringId: number;
  description: string;
  amount: number;
  category: string;
  currency: string;
  dueDate: string;
  overdueCount: number;
}

@Injectable({ providedIn: 'root' })
export class RecurringService {
  private baseUrl = environment.apiUrl + 'recurring';

  constructor(private http: HttpClient) {}

  getAll(): Observable<RecurringTransaction[]> {
    return this.http.get<RecurringTransaction[]>(this.baseUrl);
  }

  create(rule: RecurringTransaction): Observable<RecurringTransaction> {
    return this.http.post<RecurringTransaction>(this.baseUrl, rule);
  }

  update(id: number, rule: RecurringTransaction): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}`, rule);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  getDue(): Observable<DueOccurrence[]> {
    return this.http.get<DueOccurrence[]>(`${this.baseUrl}/due`);
  }

  confirm(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/confirm`, {});
  }

  skip(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/skip`, {});
  }
}
