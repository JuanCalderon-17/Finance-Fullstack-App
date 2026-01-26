export interface ExchangeRateResponse{
    base: string;        
    date: string;        
    rates: {
        [key: string]: number;  // Esto permite: rates.BRL, rates.EUR, etc.
    }
}
