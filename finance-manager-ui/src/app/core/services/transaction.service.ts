import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Transaction } from '../../shared/models/transaction.model'; // la interfaz
import { environment  } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})

export class TransactionService {
// aqui esta la URL  para iniciar app
  private baseUrl = environment.apiUrl + 'transactions/';

  constructor(private http: HttpClient) { }

  getTransactions(month?: number, year?: number): Observable<Transaction[]> {
    // month is 0-indexed in JS, 1-indexed in C# — add 1 when sending to API
    if (month !== undefined && year !== undefined) {
      const params = new HttpParams()
        .set('month', (month + 1).toString())
        .set('year', year.toString());
      return this.http.get<Transaction[]>(this.baseUrl, { params });
    }
    return this.http.get<Transaction[]>(this.baseUrl);
  }

  createTransaction(transaction: any) : Observable<any> {
    //para enviar datos post api/transactions
    return this.http.post(this.baseUrl, transaction)
  }

  deleteTransaction( id: number) : Observable<any> {
    return this.http.delete(this.baseUrl + id);
  }

  updateTransaction( id: number, transaction : any) : Observable<any> {
    transaction.id = id; //Esto sirve para evitar errores en el back
    return this.http.put(this.baseUrl +  id, transaction);
  }
}
