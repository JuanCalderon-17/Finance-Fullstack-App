import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
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

  getTransactions(): Observable<Transaction[]> {
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
