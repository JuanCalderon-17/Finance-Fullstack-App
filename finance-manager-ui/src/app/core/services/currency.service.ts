import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

interface CurrencyExchangeResponse {
    from: string;
    to: string;
    exchangeRate: number;
    updatedAt: string;
    isSuccess: boolean;
    errorMessage?: string;
}

@Injectable({
    providedIn: 'root'
})
export class CurrencyService {
    private apiUrl = `${environment.apiUrl}/currency/rate`;
    private readonly FALLBACK_RATE = 5.7;

    constructor(private http: HttpClient) {}
    
    getExchangeRate(targetCurrency: string): Observable<number> {
        const url = `${this.apiUrl}/${targetCurrency}`;
        
        console.log('🌐 URL completa:', url);
        
        return this.http.get<CurrencyExchangeResponse>(url).pipe(
            map(response => {
                console.log('📦 Respuesta del backend:', response);
                
                if (!response.isSuccess) {
                    console.warn('⚠️ Backend usó tasa de respaldo:', response.errorMessage);
                }
                
                console.log(`✅ Tasa USD a ${targetCurrency}: ${response.exchangeRate}`);
                return response.exchangeRate;
            }),
            catchError(error => {
                console.error('❌ Error llamando al backend:', error);
                console.warn('⚠️ Usando tasa de respaldo local:', this.FALLBACK_RATE);
                return of(this.FALLBACK_RATE);
            })
        );
    }
}