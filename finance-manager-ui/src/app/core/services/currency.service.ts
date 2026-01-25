import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable,  of } from "rxjs";
import { map, catchError } from 'rxjs/operators'
import { ExchangeRateResponse } from '../../shared/models/currency.model'; 

@Injectable({
    providedIn: 'root'
})

export class CurrencyService {
    private apiUrl = 'https://open.exchangerate-api.com/v6/latest/USD';//url del api
    private readonly FALLBACK_RATE = 5.7; //por si falla el api de arriba

    constructor(private http: HttpClient) {}
    

    getExchangeRate(targetCurrency: string) : Observable<number> {
        return this.http.get<ExchangeRateResponse>(this.apiUrl).pipe(
            map(response => {
                if(response.result !== 'success') {
                    throw new Error('API devuelve error')
                }
            

            // Obtener la tasa específica
            const rate = response.rates[targetCurrency];

            if(!rate) {
                throw new Error(`Moneda ${targetCurrency} no encontrada`);
            }
            
            console.log(`✅ Tasa USD a ${targetCurrency}:  ${rate}`);
            return rate; 
            }),

            catchError(error => {
                console.error('❌ Error al obtener tasa:', error);
                console.warn('⚠️ Usando tasa de respaldo:', this.FALLBACK_RATE);
                return of(this.FALLBACK_RATE);
            })             
        );
    }
}
