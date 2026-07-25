import { TestBed } from '@angular/core/testing';

import { CurrencyStateService } from './currency-state.service';

describe('CurrencyStateService', () => {
  let service: CurrencyStateService;

  beforeEach(() => {
    localStorage.removeItem('selectedCurrency');
    TestBed.configureTestingModule({});
    service = TestBed.inject(CurrencyStateService);
  });

  afterEach(() => {
    localStorage.removeItem('selectedCurrency');
  });

  it('should create', () => {
    expect(service).toBeTruthy();
  });

  it('starts in USD at rate 1', () => {
    expect(service.getCurrentCurrency()).toEqual({ code: 'USD', symbol: '$', rate: 1 });
  });

  describe('convert', () => {
    it('leaves an amount untouched when it is already in the display currency', () => {
      service.setCurrency('BRL', 'R$', 5.25);

      expect(service.convert(100, 'BRL')).toBe(100);
    });

    it('multiplies by the rate when showing a USD amount in BRL', () => {
      service.setCurrency('BRL', 'R$', 5.25);

      expect(service.convert(100, 'USD')).toBe(525);
    });

    it('divides by the rate when showing a BRL amount in USD', () => {
      // Switching back to USD keeps the BRL rate in state — it is the BRL-per-USD price.
      service.setCurrency('USD', '$', 5.25);

      expect(service.convert(525, 'BRL')).toBe(100);
    });

    it('survives a USD -> BRL -> USD round trip without drifting', () => {
      service.setCurrency('BRL', 'R$', 5.25);
      const inBrl = service.convert(1234.56, 'USD');

      service.setCurrency('USD', '$', 5.25);

      expect(service.convert(inBrl, 'BRL')).toBeCloseTo(1234.56, 10);
    });

    it('defaults the source currency to USD when a transaction has none stored', () => {
      service.setCurrency('BRL', 'R$', 4);

      expect(service.convert(10)).toBe(40);
    });

    it('ignores surrounding whitespace on the currency code', () => {
      service.setCurrency('BRL', 'R$', 5.25);

      expect(service.convert(100, ' USD ')).toBe(525);
    });

    it('passes an unsupported currency through unchanged instead of inventing a rate', () => {
      service.setCurrency('BRL', 'R$', 5.25);

      expect(service.convert(100, 'EUR')).toBe(100);
    });

    it('converts zero to zero', () => {
      service.setCurrency('BRL', 'R$', 5.25);

      expect(service.convert(0, 'USD')).toBe(0);
    });
  });

  describe('persistence', () => {
    it('stores the selected currency so a reload keeps it', () => {
      service.setCurrency('BRL', 'R$', 5.25);

      expect(JSON.parse(localStorage.getItem('selectedCurrency')!))
        .toEqual({ code: 'BRL', symbol: 'R$', rate: 5.25 });
    });

    it('restores the stored currency on load', () => {
      localStorage.setItem('selectedCurrency', JSON.stringify({ code: 'BRL', symbol: 'R$', rate: 5.25 }));

      service.loadFromStorage();

      expect(service.getCurrentCurrency().code).toBe('BRL');
      expect(service.convert(100, 'USD')).toBe(525);
    });

    it('keeps the USD default when nothing is stored', () => {
      service.loadFromStorage();

      expect(service.getCurrentCurrency()).toEqual({ code: 'USD', symbol: '$', rate: 1 });
    });

    it('emits every currency change to subscribers', () => {
      const seen: string[] = [];
      service.currency$.subscribe(c => seen.push(c.code));

      service.setCurrency('BRL', 'R$', 5.25);
      service.setCurrency('USD', '$', 5.25);

      expect(seen).toEqual(['USD', 'BRL', 'USD']);
    });
  });
});
