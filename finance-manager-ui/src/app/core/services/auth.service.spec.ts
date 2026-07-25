import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { provideTestingDependencies } from '../../../testing/test-providers';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestingDependencies()] });
    service = TestBed.inject(AuthService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
