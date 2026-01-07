import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface Debt {
  id?: number;
  name: string;
  balance: number;         // Monto Total
  interestRate: number;    // Interés
  installments: number;    // Plazo
  paidInstallments: number; // Cuotas pagadas
  color: string;
  icon: string;
}

@Injectable({
  providedIn: 'root'
})
export class DebtsService {
  private apiUrl = environment.apiUrl + 'debts';

  constructor(private http: HttpClient) { }

  getDebts(): Observable<Debt[]> {
    return this.http.get<Debt[]>(this.apiUrl);
  }

  createDebt(debt: Debt): Observable<Debt> {
    return this.http.post<Debt>(this.apiUrl, debt);
  }

  updateDebt(id: number, debt: Debt): Observable<any> {
    return this.http.put(`${this.apiUrl}/${id}`, debt);
  }

  deleteDebt(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/${id}`);
  }
}