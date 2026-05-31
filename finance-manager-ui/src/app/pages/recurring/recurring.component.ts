import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RecurringService, RecurringTransaction, RecurrenceFrequency } from '../../core/services/recurring.service';
import { CurrencyStateService } from '../../core/services/currency-state.service';

@Component({
  selector: 'app-recurring',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './recurring.component.html',
  styleUrls: ['./recurring.component.scss']
})
export class RecurringComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  rules: RecurringTransaction[] = [];
  isLoading = false;
  editingId: number | null = null;

  // Category options reused from the dashboard's buckets.
  expenseCategories = ['Food', 'Transport', 'Health', 'Education', 'Entertainment', 'Home', 'Shopping', 'Other'];
  incomeCategories = ['Salary', 'Business', 'Sale', 'Extra Income'];

  frequencies = [
    { value: RecurrenceFrequency.Weekly, key: 'RECURRING.FREQ.WEEKLY' },
    { value: RecurrenceFrequency.Biweekly, key: 'RECURRING.FREQ.BIWEEKLY' },
    { value: RecurrenceFrequency.Monthly, key: 'RECURRING.FREQ.MONTHLY' },
    { value: RecurrenceFrequency.Yearly, key: 'RECURRING.FREQ.YEARLY' }
  ];

  form: RecurringTransaction = this.emptyForm();

  status: string | null = null;
  statusKind: 'success' | 'error' | null = null;

  constructor(
    private recurringService: RecurringService,
    private currencyState: CurrencyStateService,
    private translate: TranslateService
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private emptyForm(): RecurringTransaction {
    return {
      description: '',
      amount: 0,
      category: 'Food',
      currency: this.currencyState?.getCurrentCurrency().code || 'USD',
      frequency: RecurrenceFrequency.Monthly,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: null
    };
  }

  load(): void {
    this.isLoading = true;
    this.recurringService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: (data) => { this.rules = data; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  freqLabel(freq: RecurrenceFrequency): string {
    return this.frequencies.find(f => f.value === freq)?.key || '';
  }

  startEdit(rule: RecurringTransaction): void {
    this.editingId = rule.id ?? null;
    this.form = {
      ...rule,
      startDate: (rule.startDate || '').slice(0, 10),
      endDate: rule.endDate ? rule.endDate.slice(0, 10) : null
    };
    this.status = null;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.status = null;
  }

  save(): void {
    this.status = null;
    if (!this.form.description?.trim()) {
      this.setStatus('RECURRING.ERR_DESCRIPTION', 'error');
      return;
    }
    if (!this.form.amount || this.form.amount <= 0) {
      this.setStatus('RECURRING.ERR_AMOUNT', 'error');
      return;
    }

    // Send frequency as a number; dates as ISO strings.
    const payload: RecurringTransaction = {
      ...this.form,
      frequency: Number(this.form.frequency),
      endDate: this.form.endDate || null
    };

    const req = this.editingId
      ? this.recurringService.update(this.editingId, payload)
      : this.recurringService.create(payload);

    req.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => {
        this.setStatus(this.editingId ? 'RECURRING.UPDATED' : 'RECURRING.CREATED', 'success');
        this.cancelEdit();
        this.load();
      },
      error: () => this.setStatus('RECURRING.ERR_SAVE', 'error')
    });
  }

  toggleActive(rule: RecurringTransaction): void {
    if (rule.id == null) return;
    const updated = { ...rule, isActive: !rule.isActive };
    this.recurringService.update(rule.id, updated).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.load(),
      error: () => this.setStatus('RECURRING.ERR_SAVE', 'error')
    });
  }

  remove(rule: RecurringTransaction): void {
    if (rule.id == null) return;
    const msg = this.translate.instant('RECURRING.CONFIRM_DELETE');
    if (!confirm(msg)) return;
    this.recurringService.delete(rule.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.load(),
      error: () => this.setStatus('RECURRING.ERR_SAVE', 'error')
    });
  }

  private setStatus(key: string, kind: 'success' | 'error'): void {
    this.status = this.translate.instant(key);
    this.statusKind = kind;
  }
}
