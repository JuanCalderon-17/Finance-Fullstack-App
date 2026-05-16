import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs'; // ← AGREGADO
import { environment } from '../../../environments/environment';
 
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.apiUrl + 'account/'
  
  constructor(private http: HttpClient) { }

  // Método login
  public login(model: any) {
    return this.http.post(this.baseUrl + 'login', model)
  } 

  // Método register
  public register(model: any) {
    return this.http.post(this.baseUrl + 'register', model);
  }

  // Método forgot password
  forgotPassword(email: string) {
    return this.http.post(this.baseUrl + 'forgot-password', { email });
  }

  // Método reset password (CORREGIDO)
  resetPassword(email: string, token: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.baseUrl}reset-password`, {
      email,
      token,
      newPassword
    });
  }

  verifyEmail(token: string, email: string): Observable<any> {
    return this.http.get(`${this.baseUrl}verify-email`, {
      params: { token, email }
    });
  }
}