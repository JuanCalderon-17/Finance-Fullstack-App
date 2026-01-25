export interface ExchangeRateResponse{
    result: string;
    base_code: string;
    time_last_update_unix: number;
    rates: {
        [key: string]: number;  // Esto permite: rates.BRL, rates.EUR, etc.

    }
}
