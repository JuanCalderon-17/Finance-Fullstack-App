import { Component, OnInit, OnDestroy, HostListener, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../core/services/transaction.service';
import { Transaction } from '../shared/models/transaction.model';
import { Router, RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { ThemeToggleComponent } from '../shared/theme-toggle/theme-toggle.component';
import { CurrencyService } from '../core/services/currency.service';
import { CurrencyStateService } from '../core/services/currency-state.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LanguageService } from '../core/services/language.service';
import { TutorialService } from '../core/services/tutorial.service';


@Component({
  selector: 'app-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    BaseChartDirective, 
    RouterLink,
    ThemeToggleComponent,
    TranslateModule
  ], 
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  allTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  showSettingsMenu : boolean = false; 

  // ✅ MAPA DE CATEGORÍAS: Base de Datos -> Clave JSON
  categoryMap: { [key: string]: string } = {
    // Gastos
    'Comida': 'FOOD', 'Food': 'FOOD',
    'Transporte': 'TRANSPORT', 'Transport': 'TRANSPORT',
    'Salud': 'HEALTH', 'Health': 'HEALTH',
    'Educacion': 'EDUCATION', 'Education': 'EDUCATION',
    'Ocio': 'ENTERTAINMENT', 'Entertainment': 'ENTERTAINMENT',
    'Casa': 'HOME', 'Home': 'HOME',
    'Compras': 'SHOPPING', 'Shopping': 'SHOPPING',
    'Otros': 'OTHER', 'Other': 'OTHER',
    'Ahorro': 'SAVING', 'Savings': 'SAVING', 'Poupança': 'SAVING',
    'Lazer': 'ENTERTAINMENT', 

    // Ingresos
    'Sueldo': 'SALARY', 'Salary': 'SALARY', 'Salário': 'SALARY',
    'Negocio': 'BUSINESS', 'Business': 'BUSINESS', 'Negócio': 'BUSINESS',
    'Venta': 'SALE', 'Sale': 'SALE', 'Venda': 'SALE',
    'Ingreso Extra': 'EXTRA_INCOME', 'Extra Income': 'EXTRA_INCOME', 'Renda Extra': 'EXTRA_INCOME'
  };

  //  Todo en mayúsculas para coincidir con el mapa
  incomeKeys: string[] = ['SALARY', 'BUSINESS', 'SALE', 'EXTRA_INCOME'];
  savingsKeys: string[] = ['SAVING'];

  // Para que el HTML pueda pintar de verde/rojo/indigo sin errores
  incomeCategories: string[] = ['Sueldo', 'Negocio', 'Venta', 'Ingreso Extra', 'SALARY', 'BUSINESS', 'SALE', 'EXTRA_INCOME'];
  savingsCategories: string[] = ['Ahorro', 'Savings', 'Poupança', 'SAVING'];

  newTransaction: any = {
    description: '',
    amount: 0,
    category: 'Comida', 
    transactionDate: new Date().toISOString().slice(0, 10),
    currency: 'USD'  
  };

  public pieChartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: {
      legend: {
        position: 'right',
        align: 'center',
        labels: {
          boxWidth: 8,
          boxHeight: 8,
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 14,
          font: { size: 12, weight: 500 },
          color: '#475a51'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 20, 25, 0.96)',
        padding: 12,
        cornerRadius: 10,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        boxPadding: 4,
        callbacks: {
          label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed.toFixed(2)}`
        }
      }
    }
  };
  public pieChartType: 'doughnut' = 'doughnut';

  public pieChartData: ChartData<'doughnut', number[], string | string[]> = {
    labels: [],
    datasets: [{ data: []}]
  };

  // ===== Cashflow trend chart =====
  public chartRange: '1M' | '6M' | '1Y' = '6M';
  public cashflowChartType: ChartType = 'line';
  public cashflowChartData: ChartData<'line'> = { labels: [], datasets: [] };
  public cashflowChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        align: 'end',
        labels: { boxWidth: 8, boxHeight: 8, usePointStyle: true, pointStyle: 'circle', padding: 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 20, 25, 0.96)',
        padding: 12,
        cornerRadius: 10,
        titleFont: { size: 12, weight: 'bold' },
        bodyFont: { size: 12 },
        boxPadding: 4
      }
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { font: { size: 10 }, color: '#94a3a0', padding: 8 }
      } as any,
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148,163,184,0.08)' },
        border: { display: false },
        ticks: {
          font: { size: 10 },
          color: '#94a3a0',
          padding: 8,
          maxTicksLimit: 5,
          callback: (v: any) => v >= 1000 ? (v/1000) + 'K' : v
        }
      } as any
    }
  };
  isLoadingTrend: boolean = false;

  selectedMonth: number;
  selectedYear: number;
  years: number[] = [];
  totalSpent: number = 0;
  totalIncome: number = 0;
  totalSaved: number = 0;

  alertMessageKey: string = "";
  alertColor: string = 'green';

  isLoading: boolean = false;
  loadingTooLong: boolean = false;
  loadError: boolean = false;
  private loadingTimer: any = null;
  isSubmitting: boolean = false;
  isEditing : boolean = false;
  editingId : number | null = null;
  currencyCode : string = 'USD';
  currencySymbol : string = '$';
  exchangeRate : number = 1;

  constructor(
    private transactionService: TransactionService, 
    private router: Router,
    private currencyService: CurrencyService,
    private currencyStateService: CurrencyStateService,
    private translate: TranslateService,
    public languageService: LanguageService,
    private tutorialService: TutorialService,
    private cdr: ChangeDetectorRef
  ) { 
    const today = new Date();
    this.selectedMonth = today.getMonth();
    this.selectedYear = today.getFullYear();

    for(let i = 2025; i <= 2026; i++ ) {
      this.years.push(i);
    }
  }
  
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.settings-dropdown-container')) {
      this.showSettingsMenu = false;
    }
  }
  ngOnInit(): void {
    this.currencyStateService.loadFromStorage();
    
    this.currencyStateService.currency$.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currencyCode = currency.code;
      this.currencySymbol = currency.symbol;
      this.exchangeRate = currency.rate;
      this.newTransaction.currency = currency.code;
      this.calculateStats();
      this.loadCashflowTrend();
      this.cdr.markForCheck();
    });

    // Actualizar gráfico al cambiar idioma
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateChart();
      this.loadCashflowTrend();
    });

    this.loadTransactions();
    this.loadCashflowTrend();
    
    setTimeout(() => {
      if(this.tutorialService.shouldShowTutorial()) {
        this.tutorialService.startDashboardTutorial();
      }
    },2000); //wait 2 for page to load
  }

  toggleCurrency() {
    const targetCode = this.currencyCode === 'USD' ? 'BRL' : 'USD';
    const targetSymbol = targetCode === 'BRL' ? 'R$' : '$';
    this.currencyService.getExchangeRate('BRL').subscribe({
      next: (rate) => {
        this.currencyStateService.setCurrency(targetCode, targetSymbol, rate);
      },
      error: () => {
        this.currencyStateService.setCurrency(targetCode, targetSymbol, 5.25);
      }
    });
  }

  convertTransactionAmount(transaction: Transaction): number {
    return this.currencyStateService.convert(transaction.amount, transaction.currency || 'USD');
  }

  loadTransactions() {
    this.isLoading = true;
    this.loadingTooLong = false;
    this.loadError = false;
    clearTimeout(this.loadingTimer);

    this.loadingTimer = setTimeout(() => {
      if (this.isLoading) this.loadingTooLong = true;
    }, 8000);

    this.transactionService.getTransactions(Number(this.selectedMonth), Number(this.selectedYear)).subscribe({
      next: (data) => {
        clearTimeout(this.loadingTimer);
        this.allTransactions = data;
        this.applyFilters();
        this.isLoading = false;
        this.loadingTooLong = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        clearTimeout(this.loadingTimer);
        console.error('Error al cargar transacciones:', err);
        this.isLoading = false;
        this.loadingTooLong = false;
        this.loadError = true;
        this.cdr.markForCheck();
      }
    });
  }

  applyFilters() {
    this.filteredTransactions = this.allTransactions.filter(t => {
      const date = new Date(t.transactionDate);
      return date.getMonth() === Number(this.selectedMonth) &&
             date.getFullYear() === Number(this.selectedYear);
    });
    this.calculateStats();
  }

  calculateStats() {
    this.totalSpent = 0;
    this.totalIncome = 0;
    this.totalSaved = 0;

    this.filteredTransactions.forEach(t => {
      const convertedAmount = this.convertTransactionAmount(t);
      const categoryKey = this.categoryMap[t.category] || t.category.toUpperCase();

      if (this.incomeKeys.includes(categoryKey)) {
        this.totalIncome += convertedAmount;
      } else if (this.savingsKeys.includes(categoryKey)) {
        this.totalSaved += convertedAmount;
      } else {
        this.totalSpent += convertedAmount;
      }
    });

    const limitWithBuffer = this.totalIncome * 1.10;

    if (this.totalSpent <= this.totalIncome) {
      this.alertMessageKey = "DASHBOARD.ALERTS.GOOD";
      this.alertColor = 'green';
    } else if (this.totalSpent > this.totalIncome && this.totalSpent <= limitWithBuffer) {
      this.alertMessageKey = "DASHBOARD.ALERTS.WARNING";
      this.alertColor = 'orange';
    } else {
      this.alertMessageKey = "DASHBOARD.ALERTS.DANGER";
      this.alertColor = 'red';
    }

    this.updateChart();
  }

  getCategoryType(category: string): 'income' | 'savings' | 'expense' {
    if (this.incomeCategories.includes(category)) return 'income';
    if (this.savingsCategories.includes(category)) return 'savings';
    return 'expense';
  }

  updateChart() {
    const categoryTotals: any = {};

    this.filteredTransactions.forEach(t => {
      const categoryKey = this.categoryMap[t.category] || t.category.toUpperCase();

      // Pie chart shows true spending only — excludes income AND savings
      if (this.incomeKeys.includes(categoryKey) || this.savingsKeys.includes(categoryKey)) return;

      if (!categoryTotals[categoryKey]) categoryTotals[categoryKey] = 0;
      categoryTotals[categoryKey] += this.convertTransactionAmount(t);
    });

    const labels = Object.keys(categoryTotals).map(catKey => {
       return this.translate.instant('CATEGORIES.' + catKey);
    });

    const data = Object.values(categoryTotals) as number[];

    this.pieChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#34d399', // emerald (brand)
          '#60a5fa', // sky
          '#f59e0b', // amber
          '#f87171', // soft red
          '#a78bfa', // soft violet
          '#fb923c', // soft orange
          '#2dd4bf', // teal
          '#f472b6', // soft pink
          '#94a3b8', // slate
          '#fbbf24'  // gold
        ],
        borderColor: 'transparent',
        borderWidth: 3,
        hoverOffset: 6,
        spacing: 2
      }]
    };
  }

  setChartRange(range: '1M' | '6M' | '1Y'): void {
    this.chartRange = range;
    this.loadCashflowTrend();
  }

  loadCashflowTrend(): void {
    this.isLoadingTrend = true;
    this.transactionService.getTransactions().subscribe({
      next: (all) => {
        this.buildCashflowChart(all);
        this.isLoadingTrend = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error loading cashflow trend:', err);
        this.isLoadingTrend = false;
        this.cdr.markForCheck();
      }
    });
  }

  private buildCashflowChart(all: Transaction[]): void {
    const now = new Date();
    const monthsToShow = this.chartRange === '1M' ? 1 : this.chartRange === '6M' ? 6 : 12;

    // 1M => daily buckets; 6M/1Y => monthly buckets
    if (this.chartRange === '1M') {
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const labels: string[] = [];
      const incomeArr: number[] = [];
      const expenseArr: number[] = [];
      const savingsArr: number[] = [];

      for (let d = 1; d <= daysInMonth; d++) {
        labels.push(String(d));
        incomeArr.push(0);
        expenseArr.push(0);
        savingsArr.push(0);
      }

      all.forEach(t => {
        const date = new Date(t.transactionDate);
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return;
        const day = date.getDate() - 1;
        const amount = this.convertTransactionAmount(t);
        const catKey = this.categoryMap[t.category] || t.category.toUpperCase();
        if (this.incomeKeys.includes(catKey)) incomeArr[day] += amount;
        else if (catKey === 'SAVING') savingsArr[day] += amount;
        else expenseArr[day] += amount;
      });

      this.applyCashflowData(
        labels,
        this.toCumulative(incomeArr),
        this.toCumulative(expenseArr),
        this.toCumulative(savingsArr)
      );
      return;
    }

    // Monthly buckets
    const buckets: { label: string; year: number; month: number; income: number; expense: number; savings: number }[] = [];
    for (let i = monthsToShow - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        label: date.toLocaleString(undefined, { month: 'short' }),
        year: date.getFullYear(),
        month: date.getMonth(),
        income: 0,
        expense: 0,
        savings: 0
      });
    }

    all.forEach(t => {
      const date = new Date(t.transactionDate);
      const bucket = buckets.find(b => b.month === date.getMonth() && b.year === date.getFullYear());
      if (!bucket) return;
      const amount = this.convertTransactionAmount(t);
      const catKey = this.categoryMap[t.category] || t.category.toUpperCase();
      if (this.incomeKeys.includes(catKey)) bucket.income += amount;
      else if (catKey === 'SAVING') bucket.savings += amount;
      else bucket.expense += amount;
    });

    this.applyCashflowData(
      buckets.map(b => b.label),
      this.toCumulative(buckets.map(b => b.income)),
      this.toCumulative(buckets.map(b => b.expense)),
      this.toCumulative(buckets.map(b => b.savings))
    );
  }

  private toCumulative(values: number[]): number[] {
    let sum = 0;
    return values.map(v => (sum += v));
  }

  private applyCashflowData(labels: string[], income: number[], expense: number[], savings: number[]): void {
    this.cashflowChartData = {
      labels,
      datasets: [
        {
          label: this.translate.instant('DASHBOARD.TOTAL_INCOME'),
          data: income,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.05)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#10b981',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 1.75
        },
        {
          label: this.translate.instant('DASHBOARD.TOTAL_SPENT'),
          data: expense,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.04)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ef4444',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 1.75
        },
        {
          label: this.translate.instant('DASHBOARD.TOTAL_SAVED'),
          data: savings,
          borderColor: '#6366f1',
          backgroundColor: 'rgba(99, 102, 241, 0.04)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#6366f1',
          pointBorderColor: '#fff',
          pointBorderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 5,
          borderWidth: 1.75
        }
      ]
    };
  }

  addTransaction() {
    this.newTransaction.amount = Number(this.newTransaction.amount);

    if (!this.newTransaction.description || this.newTransaction.description.trim() === '') {
      alert(this.translate.instant('TRANSACTION.ADD_DESCRIPTION'));
      return; 
    }

    if (!this.newTransaction.amount || this.newTransaction.amount <= 0) {
      alert(this.translate.instant('TRANSACTION.INVALID_AMOUNT'));
      return;
    }

    if (!this.isEditing) {
      this.newTransaction.currency = this.currencyCode;
    }

    this.isSubmitting = true;

    if (this.isEditing && this.editingId) {
      this.transactionService.updateTransaction(this.editingId, this.newTransaction).subscribe({
        next: () => {
          this.loadTransactions();
          this.loadCashflowTrend();
          this.cancelEdit();
          this.isSubmitting = false;
        },
        error: (err) => {
          console.error('Error al actualizar:', err);
          this.isSubmitting = false;
        }
      });
    }
    else {
      this.transactionService.createTransaction(this.newTransaction).subscribe({
        next: (res) => {
          this.loadTransactions();
          this.loadCashflowTrend();
          this.cancelEdit();
          this.isSubmitting = false;
        },
        error: (err) => {
          console.error('Error al crear:', err);
          this.isSubmitting = false;
        }
      });
    }
  }

  edit(transaction: Transaction) {
    this.isEditing = true;
    this.editingId = transaction.id;
    this.newTransaction = { ...transaction }; 
  }

  getCategoryKey(category: string): string {
    if (!category) return '';
    const mappedKey = this.categoryMap[category] || category.trim().toUpperCase().replace(/ /g, '_');
    return `CATEGORIES.${mappedKey}`;
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingId = null;
    this.newTransaction = { 
      description: '', 
      amount: 0, 
      category: 'Comida', 
      transactionDate: new Date().toISOString().slice(0, 10),
      currency: this.currencyCode 
    };
  }

  deleteTransaction(id: number) {
    // ✅ CORREGIDO: Traducir mensaje de confirmación
    const msg = this.translate.instant("DASHBOARD.CONFIRM_DELETE") || "Are you sure?";
    if (confirm(msg)) {
      this.transactionService.deleteTransaction(id).subscribe({
        next: () => {
          this.loadTransactions();
          this.loadCashflowTrend();
        },
        error: (err) => console.error('Error al eliminar', err)
      });
    }
  } 

  changeLanguage( language: string): void {
    this.languageService.setLanguage(language);
  }

  ngOnDestroy(): void {
    clearTimeout(this.loadingTimer);
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/auth/login']);
  }
}