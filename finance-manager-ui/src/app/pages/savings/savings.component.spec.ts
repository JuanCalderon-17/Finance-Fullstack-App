import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SavingsComponent } from './savings.component';
import { provideTestingDependencies } from '../../../testing/test-providers';

describe('SavingsComponent', () => {
  let component: SavingsComponent;
  let fixture: ComponentFixture<SavingsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SavingsComponent],
      providers: [provideTestingDependencies()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SavingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
