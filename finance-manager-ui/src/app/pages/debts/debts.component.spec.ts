import { DebtsComponent } from './debts.component';
import { CurrencyStateService } from '../../core/services/currency-state.service';
import { Debt, Installment } from '../../services/debts.service';

/**
 * calculateMetrics turns the raw schedule into everything the debts page shows:
 * how much is left, the progress bar, the next payment, the overpaid badge.
 * The component is built by hand so ngOnInit's HTTP call and tutorial timer
 * stay out of the way of the arithmetic.
 */
describe('DebtsComponent calculations', () => {
  let component: DebtsComponent;
  let currencyState: CurrencyStateService;

  const installment = (n: number, amount: number, isPaid = false): Installment => ({
    id: n,
    installmentNumber: n,
    amount,
    dueDate: '2026-06-10T12:00:00Z',
    isPaid,
    paidDate: isPaid ? '2026-01-05T12:00:00Z' : null
  });

  const debt = (overrides: Partial<Debt> = {}): Debt => ({
    id: 1,
    name: 'Card',
    originalBalance: 1200,
    interestRate: 0,
    installments: 12,
    paidInstallments: 0,
    color: '#ff416c',
    icon: 'bi-credit-card',
    currency: 'USD',
    ...overrides
  });

  /** A clean 1200 / 12 schedule of 100 each, with the first `paid` marked paid. */
  const evenSchedule = (paid = 0): Installment[] =>
    Array.from({ length: 12 }, (_, i) => installment(i + 1, 100, i < paid));

  beforeEach(() => {
    localStorage.removeItem('selectedCurrency');
    currencyState = new CurrencyStateService();
    component = new DebtsComponent(
      { getDebts: () => ({ subscribe: () => {} }) } as any, // DebtsService
      currencyState,
      { shouldShowDebtsTutorial: () => false } as any       // TutorialService
    );
  });

  afterEach(() => {
    localStorage.removeItem('selectedCurrency');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ===================== totals =====================

  describe('calculateMetrics totals', () => {
    it('adds up the whole schedule as the amount to pay', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule() }));

      expect(d.totalToPay).toBe(1200);
    });

    it('uses the schedule, not the principal, so interest is not understated', () => {
      // 1000 at 12% over 12 really costs 1066.19 — showing 1000 would lie.
      const withInterest = Array.from({ length: 12 }, (_, i) => installment(i + 1, i === 11 ? 88.84 : 88.85));

      const d = component.calculateMetrics(
        debt({ originalBalance: 1000, interestRate: 12, installmentsList: withInterest })
      );

      expect(d.totalToPay).toBeCloseTo(1066.19, 2);
    });

    it('falls back to the original balance when there is no schedule yet', () => {
      const d = component.calculateMetrics(debt({ originalBalance: 500, installmentsList: [] }));

      expect(d.totalToPay).toBe(500);
    });

    it('counts only paid installments as money actually paid', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(3) }));

      expect(d.paidAmount).toBe(300);
      expect(d.paidInstallments).toBe(3);
    });

    it('reports what is still owed', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(3) }));

      expect(d.remainingAmount).toBe(900);
    });

    it('respects the real paid amounts when the user edited an installment', () => {
      const schedule = evenSchedule(2);
      schedule[0].amount = 250; // paid more than scheduled

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.paidAmount).toBe(350);
      expect(d.totalToPay).toBe(1350);
    });
  });

  // ===================== next payment =====================

  describe('next payment', () => {
    it('is the first unpaid installment', () => {
      const schedule = evenSchedule(3);
      schedule[3].amount = 77;

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.nextPayment).toBe(77);
    });

    it('picks the lowest unpaid number even when the list arrives out of order', () => {
      const d = component.calculateMetrics(debt({
        installmentsList: [installment(3, 30), installment(1, 10), installment(2, 20)]
      }));

      expect(d.nextPayment).toBe(10);
    });

    it('is zero once everything is paid', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(12) }));

      expect(d.nextPayment).toBe(0);
    });
  });

  // ===================== progress =====================

  describe('progress', () => {
    it('is the share of the total already paid', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(3) }));

      expect(d.progress).toBeCloseTo(25, 10);
    });

    it('is zero on a brand new debt', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(0) }));

      expect(d.progress).toBe(0);
    });

    it('is 100 when every installment is settled', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(12) }));

      expect(d.progress).toBe(100);
    });

    it('never exceeds 100 so the bar cannot overflow', () => {
      const schedule = evenSchedule(12);
      schedule[0].amount = 5000;

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.progress).toBe(100);
    });

    it('is zero rather than NaN when there is nothing to pay', () => {
      const d = component.calculateMetrics(debt({ originalBalance: 0, installmentsList: [] }));

      expect(d.progress).toBe(0);
    });
  });

  // ===================== paid off / overpaid =====================

  describe('paid off and overpaid', () => {
    it('is not paid in full while installments remain', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(11) }));

      expect(d.isPaidInFull).toBeFalse();
      expect(d.isOverpaid).toBeFalse();
    });

    it('is paid in full when every installment is settled', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule(12) }));

      expect(d.isPaidInFull).toBeTrue();
      expect(d.remainingAmount).toBe(0);
    });

    // KNOWN GAP — documented, not endorsed. `remainingAmount` is derived as
    // (sum of ALL installments) - (sum of PAID installments), i.e. the sum of the
    // unpaid ones, which can never go below zero. Editing a paid installment
    // upwards raises both terms equally, so `isOverpaid` never becomes true and
    // the "overpaid" badge in the template is currently unreachable. Detecting a
    // real overpayment would require comparing against the debt's expected total.
    // When that is fixed this expectation should flip.
    it('does not currently detect an overpayment (known gap)', () => {
      const schedule = evenSchedule(12);
      schedule[0].amount = 150; // 50 more than the plan asked for

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.isOverpaid).toBeFalse();
      expect(d.overpaidAmount).toBe(0);
    });

    it('never shows a negative remaining amount', () => {
      const schedule = evenSchedule(12);
      schedule[0].amount = 900;

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.remainingAmount).toBe(0);
    });

    it('does not call a sub-cent rounding gap an overpayment', () => {
      const schedule = evenSchedule(12);
      schedule[0].amount = 100.005;

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.isOverpaid).toBeFalse();
    });
  });

  // ===================== "adjusted" badge =====================

  describe('adjusted-schedule flag', () => {
    it('is off for a plain schedule that matches the debt terms', () => {
      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule() }));

      expect(d.hasDelta).toBeFalse();
    });

    it('is off for an interest-bearing schedule — interest is expected, not an edit', () => {
      const withInterest = Array.from({ length: 12 }, (_, i) => installment(i + 1, i === 11 ? 88.84 : 88.85));

      const d = component.calculateMetrics(
        debt({ originalBalance: 1000, interestRate: 12, installmentsList: withInterest })
      );

      expect(d.hasDelta).toBeFalse();
    });

    it('turns on once the schedule drifts from what the terms predict', () => {
      const schedule = evenSchedule();
      schedule[0].amount = 400;

      const d = component.calculateMetrics(debt({ installmentsList: schedule }));

      expect(d.hasDelta).toBeTrue();
    });

    it('stays off for a debt with no schedule at all', () => {
      const d = component.calculateMetrics(debt({ installmentsList: [] }));

      expect(d.hasDelta).toBeFalse();
    });
  });

  // ===================== currency =====================

  describe('display currency', () => {
    it('shows each installment converted into the active currency', () => {
      currencyState.setCurrency('BRL', 'R$', 5);

      const d = component.calculateMetrics(debt({ installmentsList: evenSchedule() }));

      expect(d.installmentsList[0].displayAmount).toBe(500);
    });

    it('rounds the editable installment input to cents', () => {
      currencyState.setCurrency('BRL', 'R$', 5.2537);

      const d = component.calculateMetrics(debt({ installmentsList: [installment(1, 100)] }));

      expect(d.installmentsList[0].displayAmount).toBe(525.37);
    });
  });

  // ===================== portfolio total =====================

  describe('calculateTotal', () => {
    it('adds up what is still owed across every debt', () => {
      component.debts = [
        component.calculateMetrics(debt({ id: 1, installmentsList: evenSchedule(3) })),   // 900 left
        component.calculateMetrics(debt({ id: 2, installmentsList: evenSchedule(12) }))   // paid off
      ];

      component.calculateTotal();

      expect(component.totalDebt).toBe(900);
    });

    it('converts the total into the active display currency', () => {
      component.debts = [component.calculateMetrics(debt({ installmentsList: evenSchedule(3) }))];
      currencyState.setCurrency('BRL', 'R$', 5);

      component.calculateTotal();

      expect(component.totalDebt).toBe(4500);
    });

    it('is zero with no debts', () => {
      component.debts = [];

      component.calculateTotal();

      expect(component.totalDebt).toBe(0);
    });
  });

  // ===================== overdue =====================

  describe('isOverdue', () => {
    it('flags a due date in the past', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      expect(component.isOverdue(yesterday.toISOString())).toBeTrue();
    });

    it('does not flag an installment due today', () => {
      expect(component.isOverdue(new Date().toISOString())).toBeFalse();
    });

    it('does not flag a future due date', () => {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);

      expect(component.isOverdue(nextMonth.toISOString())).toBeFalse();
    });
  });
});
