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

  // Para que el HTML pueda pintar de verde/rojo sin errores
  incomeCategories: string[] = ['Sueldo', 'Negocio', 'Venta', 'Ingreso Extra', 'SALARY', 'BUSINESS', 'SALE', 'EXTRA_INCOME'];

  newTransaction: any = {
    description: '',
    amount: 0,
    category: 'Comida', 
    transactionDate: new Date().toISOString().slice(0, 10),
    currency: 'USD'  
  };

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right' }
    }
  };
  public pieChartType: ChartType = 'pie';

  public pieChartData: ChartData<'pie', number[], string | string[]> = {
    labels: [],
    datasets: [{ data: []}]
  };

  selectedMonth: number;
  selectedYear: number;
  years: number[] = [];
  totalSpent: number = 0;
  totalIncome: number = 0;

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
      this.cdr.markForCheck();
    });

    // Actualizar gráfico al cambiar idioma
    this.translate.onLangChange.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateChart();
    });

    this.loadTransactions();
    
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
      },
      error: (err) => {
        clearTimeout(this.loadingTimer);
        console.error('Error al cargar transacciones:', err);
        this.isLoading = false;
        this.loadingTooLong = false;
        this.loadError = true;
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

    this.filteredTransactions.forEach(t => {
      const convertedAmount = this.convertTransactionAmount(t);
      const categoryKey = this.categoryMap[t.category] || t.category.toUpperCase(); // with this i get actual api 
      
      // comparar con api mapeada
      if (this.incomeKeys.includes(categoryKey)) {
        this.totalIncome += convertedAmount;
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

  updateChart() {
    const categoryTotals: any = {};

    this.filteredTransactions.forEach(t => {
      const categoryKey = this.categoryMap[t.category] || t.category.toUpperCase();

      // Solo graficamos gastos (NO ingresos)
      if(!this.incomeKeys.includes(categoryKey)) { 
        if(!categoryTotals[categoryKey]) {
          categoryTotals[categoryKey] = 0;
        }
        categoryTotals[categoryKey] += this.convertTransactionAmount(t);
      }
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
          '#00d2d3', '#ff9f43', '#5f27cd', '#ff6b6b', '#10ac84', 
          '#2e86de', '#f368e0', '#feca57', '#341f97', '#48dbfb'
        ],
        borderColor: '#1a1a2e',
        borderWidth: 2
      }]
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