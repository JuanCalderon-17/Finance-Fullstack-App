import { TestBed } from '@angular/core/testing';

import { TutorialService } from './tutorial.service';
import { provideTestingDependencies } from '../../../testing/test-providers';

describe('TutorialService', () => {
  let service: TutorialService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTestingDependencies()] });
    service = TestBed.inject(TutorialService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
