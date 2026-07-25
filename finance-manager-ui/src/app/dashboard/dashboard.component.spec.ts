import { DashboardComponent } from './dashboard.component';
import { CurrencyStateService } from '../core/services/currency-state.service';
import { Transaction } from '../shared/models/transaction.model';

/**
 * The dashboard numbers (totals, available ratio, overspending alert, charts) are
 * what the user reads as "their money", so they are unit tested directly.
 *
 * The component is instantiated by hand instead of through TestBed: ngOnInit fires
 * HTTP calls, timers and the tutorial, none of which the arithmetic depends on.
 */
describe('DashboardComponent calculations', () => {
  let component: DashboardComponent;
  let currencyState: CurrencyStateService;

  const tx = (amount: number, category: string, opts: Partial<Transaction> = {}): Transaction => ({
    id: opts.id ?? 1,
    description: opts.description ?? 'test',
    amount,
    category,
    currency: opts.currency ?? 'USD',
    transactionDate: opts.transactionDate ?? new Date()
  });

  beforeEach(() => {
    localStorage.removeItem('selectedCurrency');
    currencyState = new CurrencyStateService();

    const noop = () => {};
    component = new DashboardComponent(
      { getTransactions: () => ({ subscribe: noop }) } as any,   // TransactionService
      { getDue: () => ({ pipe: () => ({ subscribe: noop }) }) } as any, // RecurringService
      { navigate: noop } as any,                                  // Router
      {} as any,                                                  // CurrencyService
      currencyState,
      { instant: (key: string) => key, onLangChange: { pipe: () => ({ subscribe: noop }) } } as any, // TranslateService
      { getCurrentLanguage: () => 'es' } as any,                  // LanguageService
      {} as any,                                                  // TutorialService
      {} as any,                                                  // ChatService
      { markForCheck: noop } as any                               // ChangeDetectorRef
    );
  });

  afterEach(() => {
    localStorage.removeItem('selectedCurrency');
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ===================== calculateStats: classification =====================

  describe('calculateStats', () => {
    it('splits transactions into income, savings and spending', () => {
      component.filteredTransactions = [
        tx(3000, 'Sueldo'),
        tx(500, 'Ahorro'),
        tx(200, 'Comida'),
        tx(100, 'Transporte')
      ];

      component.calculateStats();

      expect(component.totalIncome).toBe(3000);
      expect(component.totalSaved).toBe(500);
      expect(component.totalSpent).toBe(300);
    });

    it('classifies the same category the same way in every language', () => {
      component.filteredTransactions = [
        tx(1000, 'Sueldo'), tx(1000, 'Salary'), tx(1000, 'Salário'),
        tx(100, 'Ahorro'), tx(100, 'Savings'), tx(100, 'Poupança'),
        tx(10, 'Comida'), tx(10, 'Food')
      ];

      component.calculateStats();

      expect(component.totalIncome).toBe(3000);
      expect(component.totalSaved).toBe(300);
      expect(component.totalSpent).toBe(20);
    });

    it('counts every income category as income', () => {
      component.filteredTransactions = [
        tx(1000, 'Sueldo'), tx(200, 'Negocio'), tx(50, 'Venta'), tx(25, 'Ingreso Extra')
      ];

      component.calculateStats();

      expect(component.totalIncome).toBe(1275);
      expect(component.totalSpent).toBe(0);
    });

    it('treats an unknown category as spending rather than dropping it', () => {
      // Losing a transaction from the totals is worse than filing it under expenses.
      component.filteredTransactions = [tx(1000, 'Sueldo'), tx(75, 'Mascotas')];

      component.calculateStats();

      expect(component.totalSpent).toBe(75);
    });

    it('resets the totals on every recalculation instead of accumulating', () => {
      component.filteredTransactions = [tx(1000, 'Sueldo'), tx(400, 'Comida')];
      component.calculateStats();
      component.calculateStats();

      expect(component.totalIncome).toBe(1000);
      expect(component.totalSpent).toBe(400);
    });

    it('zeroes the totals when there are no transactions', () => {
      component.filteredTransactions = [];

      component.calculateStats();

      expect(component.totalIncome).toBe(0);
      expect(component.totalSpent).toBe(0);
      expect(component.totalSaved).toBe(0);
    });

    it('converts every amount to the display currency before adding it up', () => {
      currencyState.setCurrency('BRL', 'R$', 5);
      component.filteredTransactions = [
        tx(1000, 'Sueldo', { currency: 'USD' }),   // -> 5000 BRL
        tx(500, 'Comida', { currency: 'BRL' }),    // -> 500 BRL
        tx(100, 'Ahorro', { currency: 'USD' })     // -> 500 BRL
      ];

      component.calculateStats();

      expect(component.totalIncome).toBe(5000);
      expect(component.totalSpent).toBe(500);
      expect(component.totalSaved).toBe(500);
    });

    it('does not double-convert amounts already in the display currency', () => {
      currencyState.setCurrency('BRL', 'R$', 5.25);
      component.filteredTransactions = [tx(100, 'Comida', { currency: 'BRL' })];

      component.calculateStats();

      expect(component.totalSpent).toBe(100);
    });
  });

  // ===================== availableRatio =====================

  describe('availableRatio', () => {
    it('is null when there is no income to divide by', () => {
      component.totalIncome = 0;
      component.totalSpent = 250;

      expect(component.availableRatio).toBeNull();
    });

    it('is the share of income left after spending and saving', () => {
      component.totalIncome = 1000;
      component.totalSpent = 400;
      component.totalSaved = 100;

      expect(component.availableRatio).toBeCloseTo(0.5, 10);
    });

    it('counts savings as money no longer available', () => {
      component.totalIncome = 1000;
      component.totalSpent = 0;
      component.totalSaved = 300;

      expect(component.availableRatio).toBeCloseTo(0.7, 10);
    });

    it('is 1 when nothing has been spent or saved', () => {
      component.totalIncome = 1000;
      component.totalSpent = 0;
      component.totalSaved = 0;

      expect(component.availableRatio).toBe(1);
    });

    it('goes negative when the user spent more than they earned', () => {
      component.totalIncome = 1000;
      component.totalSpent = 1500;
      component.totalSaved = 0;

      expect(component.availableRatio).toBeCloseTo(-0.5, 10);
    });
  });

  // ===================== alert thresholds =====================

  describe('overspending alert', () => {
    const statsFor = (income: number, spent: number) => {
      component.filteredTransactions = [
        ...(income ? [tx(income, 'Sueldo')] : []),
        ...(spent ? [tx(spent, 'Comida')] : [])
      ];
      component.calculateStats();
      return component.alertMessageKey;
    };

    it('says nothing is recorded yet when the month is empty', () => {
      expect(statsFor(0, 0)).toBe('DASHBOARD.ALERTS.EMPTY');
    });

    it('flags a missing income record instead of shouting "overspent"', () => {
      expect(statsFor(0, 500)).toBe('DASHBOARD.ALERTS.NO_INCOME');
    });

    it('is happy while spending stays within income', () => {
      expect(statsFor(1000, 999)).toBe('DASHBOARD.ALERTS.GOOD');
    });

    it('is still happy when spending exactly equals income', () => {
      expect(statsFor(1000, 1000)).toBe('DASHBOARD.ALERTS.GOOD');
    });

    it('warns inside the 10% buffer over income', () => {
      expect(statsFor(1000, 1050)).toBe('DASHBOARD.ALERTS.WARNING');
    });

    it('still only warns at exactly 110% of income', () => {
      expect(statsFor(1000, 1100)).toBe('DASHBOARD.ALERTS.WARNING');
    });

    it('escalates to danger past the 10% buffer', () => {
      expect(statsFor(1000, 1101)).toBe('DASHBOARD.ALERTS.DANGER');
    });

    it('ignores savings when judging overspending', () => {
      // Money moved to savings is not overspending.
      component.filteredTransactions = [tx(1000, 'Sueldo'), tx(900, 'Ahorro'), tx(100, 'Comida')];
      component.calculateStats();

      expect(component.alertMessageKey).toBe('DASHBOARD.ALERTS.GOOD');
    });
  });

  // ===================== pie chart =====================

  describe('updateChart', () => {
    it('charts spending only — income and savings are excluded', () => {
      component.filteredTransactions = [
        tx(3000, 'Sueldo'),
        tx(500, 'Ahorro'),
        tx(200, 'Comida'),
        tx(100, 'Transporte')
      ];

      component.updateChart();

      expect(component.pieChartData.labels).toEqual(['CATEGORIES.FOOD', 'CATEGORIES.TRANSPORT']);
      expect(component.pieChartData.datasets[0].data).toEqual([200, 100]);
    });

    it('merges the same category across languages into one slice', () => {
      component.filteredTransactions = [tx(30, 'Comida'), tx(20, 'Food'), tx(10, 'Comida')];

      component.updateChart();

      expect(component.pieChartData.labels).toEqual(['CATEGORIES.FOOD']);
      expect(component.pieChartData.datasets[0].data).toEqual([60]);
    });

    it('converts slice values to the display currency', () => {
      currencyState.setCurrency('BRL', 'R$', 5);
      component.filteredTransactions = [tx(20, 'Comida', { currency: 'USD' })];

      component.updateChart();

      expect(component.pieChartData.datasets[0].data).toEqual([100]);
    });

    it('produces an empty chart when there is nothing to spend on', () => {
      component.filteredTransactions = [tx(3000, 'Sueldo')];

      component.updateChart();

      expect(component.pieChartData.labels).toEqual([]);
      expect(component.pieChartData.datasets[0].data).toEqual([]);
    });
  });

  // ===================== category helpers =====================

  describe('category helpers', () => {
    it('maps every known category name to its shared translation key', () => {
      expect(component.getCategoryKey('Comida')).toBe('CATEGORIES.FOOD');
      expect(component.getCategoryKey('Food')).toBe('CATEGORIES.FOOD');
      expect(component.getCategoryKey('Poupança')).toBe('CATEGORIES.SAVING');
    });

    it('falls back to an upper-snake-case key for unmapped categories', () => {
      expect(component.getCategoryKey('  pet care ')).toBe('CATEGORIES.PET_CARE');
    });

    it('returns an empty key for a missing category instead of crashing', () => {
      expect(component.getCategoryKey('')).toBe('');
    });

    it('reports the type used for colouring rows', () => {
      expect(component.getCategoryType('Sueldo')).toBe('income');
      expect(component.getCategoryType('Ahorro')).toBe('savings');
      expect(component.getCategoryType('Comida')).toBe('expense');
      expect(component.getCategoryType('Mascotas')).toBe('expense');
    });
  });

  // ===================== cashflow trend =====================

  describe('cashflow trend', () => {
    const buildChart = (all: Transaction[]) => (component as any).buildCashflowChart(all);

    it('accumulates monthly buckets so each point is the running total', () => {
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 10);
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 10);

      component.chartRange = '6M';
      buildChart([
        tx(100, 'Sueldo', { transactionDate: lastMonth }),
        tx(100, 'Sueldo', { transactionDate: thisMonth })
      ]);

      const income = component.cashflowChartData.datasets[0].data as number[];
      expect(income.length).toBe(6);
      expect(income[4]).toBe(100);   // last month
      expect(income[5]).toBe(200);   // cumulative through this month
    });

    it('keeps income, spending and savings on separate series', () => {
      const thisMonth = new Date();

      component.chartRange = '6M';
      buildChart([
        tx(1000, 'Sueldo', { transactionDate: thisMonth }),
        tx(300, 'Comida', { transactionDate: thisMonth }),
        tx(200, 'Ahorro', { transactionDate: thisMonth })
      ]);

      const [income, expense, savings] = component.cashflowChartData.datasets.map(d => d.data as number[]);
      expect(income[5]).toBe(1000);
      expect(expense[5]).toBe(300);
      expect(savings[5]).toBe(200);
    });

    it('ignores transactions outside the selected range', () => {
      const twoYearsAgo = new Date();
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

      component.chartRange = '6M';
      buildChart([tx(999, 'Sueldo', { transactionDate: twoYearsAgo })]);

      const income = component.cashflowChartData.datasets[0].data as number[];
      expect(income.every(v => v === 0)).toBeTrue();
    });

    it('uses one bucket per day of the current month on the 1M range', () => {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

      component.chartRange = '1M';
      buildChart([tx(50, 'Sueldo', { transactionDate: new Date(now.getFullYear(), now.getMonth(), 1) })]);

      const income = component.cashflowChartData.datasets[0].data as number[];
      expect(income.length).toBe(daysInMonth);
      expect(income[0]).toBe(50);
      expect(income[daysInMonth - 1]).toBe(50); // stays flat — cumulative, not reset
    });

    it('shows 12 buckets on the 1Y range', () => {
      component.chartRange = '1Y';
      buildChart([]);

      expect(component.cashflowChartData.labels!.length).toBe(12);
    });

    it('converts trend amounts to the display currency', () => {
      currencyState.setCurrency('BRL', 'R$', 5);
      component.chartRange = '6M';
      buildChart([tx(100, 'Sueldo', { transactionDate: new Date(), currency: 'USD' })]);

      const income = component.cashflowChartData.datasets[0].data as number[];
      expect(income[5]).toBe(500);
    });
  });

  // ===================== transaction form =====================

  describe('transaction type selector', () => {
    it('offers only the categories that belong to the chosen type', () => {
      component.setTransactionType('income');
      expect(component.visibleCategories).toContain('Sueldo');
      expect(component.visibleCategories).not.toContain('Comida');
    });

    it('switches the category when the current one no longer fits the type', () => {
      component.newTransaction.category = 'Comida';

      component.setTransactionType('income');

      expect(component.newTransaction.category).toBe('Sueldo');
    });

    it('keeps the category when it is still valid for the type', () => {
      component.setTransactionType('expense');
      component.newTransaction.category = 'Transporte';

      component.setTransactionType('expense');

      expect(component.newTransaction.category).toBe('Transporte');
    });
  });
});
