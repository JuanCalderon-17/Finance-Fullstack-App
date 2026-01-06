import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface SavingAccount {
  id?: number;
  name: string;
  balance: number;
  goal?: number;
  color: string;
  icon: string;
  isEditing?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SavingsService {
  // Asegúrate de que esta URL coincida con tu backend
  private apiUrl = environment.apiUrl + 'savings'; 

  constructor(private http: HttpClient) { }

  getSavings(): Observable<SavingAccount[]> {
    return this.http.get<SavingAccount[]>(this.apiUrl);
  }

  createSaving(saving: SavingAccount): Observable<SavingAccount> {
    return this.http.post<SavingAccount>(this.apiUrl, saving);
  }

  updateSaving(id: number, saving: SavingAccount): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, saving);
  }

  deleteSaving(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}