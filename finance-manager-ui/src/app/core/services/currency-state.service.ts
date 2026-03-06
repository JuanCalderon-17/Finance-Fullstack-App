import  { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs'

export interface CurrencyState { 
    code: string;
    symbol: string;
    rate: number;
} 

@Injectable({
    providedIn: 'root'
})
export class CurrencyStateService {
    private currencyState = new BehaviorSubject<CurrencyState>({
        code: 'USD', 
        symbol: '$', 
        rate: 1
    })

    public currency$  = this.currencyState.asObservable();

    getCurrentCurrency(): CurrencyState  {
        return this.currencyState.value;
    }

    setCurrency(code: string, symbol: string, rate: number): void {
        this.currencyState.next({code, symbol, rate});
        localStorage.setItem('selectedCurrency', JSON.stringify({ code, symbol, rate }));
    }

    loadFromStorage(): void {
        const stored = localStorage.getItem('selectedCurrency');
        if(stored) {
            const currency = JSON.parse(stored)
            this.currencyState.next(currency);
        }
    }

    convert(amount: number, fromCurrency: string = 'USD'): number {
        const { code, rate } = this.currencyState.value;
        const from = fromCurrency.trim();
        const to = code.trim();

        if (from === to) return amount;
        if (from === 'USD' && to === 'BRL') return amount * rate;
        if (from === 'BRL' && to === 'USD') return amount / rate;
        return amount;
    }
}
