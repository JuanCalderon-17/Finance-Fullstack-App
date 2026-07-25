import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';

import { TransactionService } from './transaction.service';
import { environment } from '../../../environments/environment';

describe('TransactionService', () => {
  let service: TransactionService;
  let httpMock: HttpTestingController;
  const baseUrl = environment.apiUrl + 'transactions/';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(TransactionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getTransactions', () => {
    it('shifts the month from 0-indexed JS to 1-indexed API', () => {
      // Getting this wrong shows the user another month's money.
      service.getTransactions(0, 2026).subscribe();

      const req = httpMock.expectOne(r => r.url === baseUrl);
      expect(req.request.params.get('month')).toBe('1');
      expect(req.request.params.get('year')).toBe('2026');
      req.flush([]);
    });

    it('shifts December correctly too', () => {
      service.getTransactions(11, 2026).subscribe();

      const req = httpMock.expectOne(r => r.url === baseUrl);
      expect(req.request.params.get('month')).toBe('12');
      req.flush([]);
    });

    it('asks for everything when no month and year are given', () => {
      service.getTransactions().subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.params.keys().length).toBe(0);
      req.flush([]);
    });
  });

  describe('writes', () => {
    it('posts a new transaction', () => {
      const payload = { description: 'Lunch', amount: 12.5, category: 'Comida', currency: 'USD' };

      service.createTransaction(payload).subscribe();

      const req = httpMock.expectOne(baseUrl);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(payload);
      req.flush({});
    });

    it('puts the id into the body on update, which the API requires', () => {
      const payload: any = { description: 'Lunch', amount: 12.5 };

      service.updateTransaction(42, payload).subscribe();

      const req = httpMock.expectOne(baseUrl + '42');
      expect(req.request.method).toBe('PUT');
      expect(req.request.body.id).toBe(42);
      req.flush({});
    });

    it('deletes by id', () => {
      service.deleteTransaction(42).subscribe();

      const req = httpMock.expectOne(baseUrl + '42');
      expect(req.request.method).toBe('DELETE');
      req.flush({});
    });
  });
});
