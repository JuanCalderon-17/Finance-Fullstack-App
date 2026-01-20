import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';


export interface Installment {
  id: number;
  installmentNumber: number;
  amount: number;
  dueDate: string;
  isPaid: boolean;
  paidDate: string | null;
}

export interface Debt {
  id?: number;
  name: string;
  balance: number;
  interestRate: number;
  installments: number;
  paidInstallments: number; // Calculado desde installmentsList
  color: string;
  icon: string;
  installmentsList?: Installment[]; // ← NUEVO
}

@Injectable({
  providedIn: 'root'
})
export class DebtsService {
  private apiUrl = environment.apiUrl + 'debts'; 

  constructor(private http: HttpClient) {}

  getDebts(): Observable<Debt[]> {
    return this.http.get<Debt[]>(this.apiUrl);
  }

  getDebt(id: number): Observable<Debt> {
    return this.http.get<Debt>(`${this.apiUrl}/${id}`);
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

  // ← NUEVO: Toggle de cuota
  toggleInstallment(debtId: number, installmentId: number): Observable<any> {
    return this.http.put(
      `${this.apiUrl}/${debtId}/installments/${installmentId}/toggle`,
      {}
    );
  }
}