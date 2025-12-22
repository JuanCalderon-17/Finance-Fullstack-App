import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
 
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private baseUrl = environment.apiUrl + 'account/'
  constructor(private http: HttpClient) { }

  // Creamos metodo login
  public login(model: any) {
    return this.http.post(this.baseUrl + 'login', model)
  } 

  public register(model: any) {
    // Esto llama a tu endpoint POST api/Account/register
    return this.http.post(this.baseUrl + 'register', model);
  }
}
