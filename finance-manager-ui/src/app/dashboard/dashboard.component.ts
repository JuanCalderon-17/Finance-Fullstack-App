import { Component, OnInit } from '@angular/core';
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

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    FormsModule, 
    BaseChartDirective, 
    RouterLink,
    ThemeToggleComponent  
  ], 
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  
  allTransactions: Transaction[] = [];
  filteredTransactions: Transaction[] = [];
  incomeCategories: string[] = ['Sueldo', 'Negocio', 'Venta', 'Ingreso Extra'];

  newTransaction: any = {
    description: '',
    amount: 0,
    category: 'Comida',
    transactionDate: new Date().toISOString().slice(0, 10),
    currency: 'USD'  // ✅ NUEVO CAMPO
  }

  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
      }
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
  selectedPeriod: string = 'all';

  totalSpent: number = 0;
  totalIncome: number = 0;
  alertMessage: string = "";
  alertColor: string = 'green';
  isEditing : boolean = false;
  editingId : number | null = null;
  currencyCode : string = 'USD';
  currencySymbol : string = '$';
  exchangeRate : number = 1;

  constructor(
    private transactionService: TransactionService, 
    private router: Router,
    private currencyService: CurrencyService,
    private currencyStateService: CurrencyStateService
  ) { 
    const today = new Date();
    this.selectedMonth = today.getMonth();
    this.selectedYear = today.getFullYear();

    for(let i = 2025; i <= 2026; i++ ) {
      this.years.push(i);
    }
  }
  
  ngOnInit(): void {
    this.currencyStateService.loadFromStorage();
    
    this.currencyStateService.currency$.subscribe(currency => {
      this.currencyCode = currency.code;
      this.currencySymbol = currency.symbol;
      this.exchangeRate = currency.rate;
      this.newTransaction.currency = currency.code;  // ✅ Sincronizar formulario
      this.calculateStats();  // ✅ Recalcular al cambiar moneda
    });

    this.loadTransactions();
  }

  toggleCurrency() {
    if(this.currencyCode === 'USD') {
      this.currencyService.getExchangeRate('BRL').subscribe({
        next: (rate) => {
          this.currencyStateService.setCurrency('BRL', 'R$', rate);
        },
        error: (err) => {
          console.error('Error cargando tasa:', err);
          this.currencyStateService.setCurrency('BRL', 'R$', 5.7);
        }
      });
    }
    else {
      this.currencyStateService.setCurrency('USD', '$', 1);
    }
  }

  // ✅ NUEVA FUNCIÓN: Convertir monto según la moneda original
  convertTransactionAmount(transaction: Transaction): number {
    const txCurrency = transaction.currency || 'USD';
    
    // Si la transacción y la vista están en la misma moneda
    if (txCurrency === this.currencyCode) {
      return transaction.amount;
    }
    
    // Si la transacción está en USD y vemos en BRL
    if (txCurrency === 'USD' && this.currencyCode === 'BRL') {
      return transaction.amount * this.exchangeRate;
    }
    
    // Si la transacción está en BRL y vemos en USD
    if (txCurrency === 'BRL' && this.currencyCode === 'USD') {
      return transaction.amount / this.exchangeRate;
    }
    
    return transaction.amount;
  }

  loadTransactions() {
    this.transactionService.getTransactions().subscribe({
      next: (data) => {
        this.allTransactions = data;
        this.applyFilters();
      },
      error: (err) => {
        console.error('Error al cargar transacciones:', err);
      }
    });
  }

  applyFilters() {
    this.filteredTransactions = this.allTransactions.filter(t => {
      const date = new Date(t.transactionDate);
      const transactionDay = parseInt(t.transactionDate.toString().slice(8,10));
      const matchesMonthYear =  date.getMonth() === +this.selectedMonth && 
                                date.getFullYear() === +this.selectedYear;

      if (!matchesMonthYear) return false;

      if(this.selectedPeriod === 'all') {
        return true;
      } else if (this.selectedPeriod === '1') {
        return transactionDay <= 15;
      } else {
        return transactionDay > 15;
      }
    });

    this.calculateStats();
  }

  calculateStats() {
    this.totalSpent = 0;
    this.totalIncome = 0;

    // ✅ USAR CONVERSIÓN INTELIGENTE
    this.filteredTransactions.forEach(t => {
      const convertedAmount = this.convertTransactionAmount(t);
      
      if (this.incomeCategories.includes(t.category)) {
        this.totalIncome += convertedAmount;
      } else {
        this.totalSpent += convertedAmount;
      }
    });
    
    const limitWithBuffer = this.totalIncome * 1.10; 

    if (this.totalSpent <= this.totalIncome) {
      this.alertMessage = "Vamos bien. ¡Estás dentro de tus posibilidades!";
      this.alertColor = 'green';
    } else if (this.totalSpent > this.totalIncome && this.totalSpent <= limitWithBuffer) {
      this.alertMessage = `Cuidado: Te has pasado un poco. ¡Frena los gastos!`;
      this.alertColor = 'orange';
    } else {
      this.alertMessage = '¡ALERTA ROJA! Has superado tu límite de seguridad del 10%.';
      this.alertColor = 'red';
    }

    this.updateChart();
  }

  updateChart() {
    const categoryTotals: any = {};

    // ✅ USAR CONVERSIÓN INTELIGENTE EN EL GRÁFICO
    this.filteredTransactions.forEach(t => {
      if(!this.incomeCategories.includes(t.category)) {
        if(!categoryTotals[t.category]) {
          categoryTotals[t.category] = 0;
        }
        categoryTotals[t.category] += this.convertTransactionAmount(t);
      }
    })

    const labels = Object.keys(categoryTotals)
    const data = Object.values(categoryTotals) as number[];

    this.pieChartData = {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: [
          '#00d2d3',
          '#ff9f43',
          '#5f27cd',
          '#ff6b6b',
          '#10ac84',
          '#2e86de',
          '#f368e0',
          '#feca57'
        ],
        borderColor: '#1a1a2e',
        borderWidth: 2
      }]
    };
  }  

  addTransaction() {
    this.newTransaction.amount = Number(this.newTransaction.amount);

    if (!this.newTransaction.description || this.newTransaction.description.trim() === '') {
      alert('⚠️ Por favor agrega una descripción para el movimiento.')
      return; 
    }

    if (!this.newTransaction.amount || this.newTransaction.amount <= 0) {
      alert('⚠️ El monto debe ser mayor a 0.')
      return;
    }

    // ✅ GUARDAR LA MONEDA ACTUAL
    this.newTransaction.currency = this.currencyCode;
    console.log('🔍 Datos a enviar:', this.newTransaction); //for testing purpose, observe if sends data


    if (this.isEditing && this.editingId) {
      this.transactionService.updateTransaction(this.editingId, this.newTransaction).subscribe({
        next: () => {
          this.loadTransactions();
          this.cancelEdit();
        },
        error: (err) => console.error('Error al actualizar:', err)
      });
    }
    else {
      this.transactionService.createTransaction(this.newTransaction).subscribe({
        next: (res) => {
          this.loadTransactions();
          this.newTransaction.description = '';
          this.newTransaction.amount = 0;
          this.newTransaction.currency = this.currencyCode;
          this.cancelEdit();
        },
        error: (err) => console.error('Error al crear:', err)
      });
    }
  }

  edit(transaction: Transaction) {
    this.isEditing = true;
    this.editingId = transaction.id;
    this.newTransaction = { ...transaction }; 
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingId = null;
    this.newTransaction = { 
      description: '', 
      amount: 0, 
      category: 'Comida', 
      transactionDate: new Date().toISOString().slice(0, 10),
      currency: this.currencyCode  // ✅ Mantener moneda actual
    };
  }

  deleteTransaction(id: number) {
    if (confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
      this.transactionService.deleteTransaction(id).subscribe({
        next: () => {
          this.loadTransactions();
        },
        error: (err) => console.error('Error al eliminar', err)
      });
    }
  }

  logout() {
    localStorage.removeItem('user');
    this.router.navigate(['/auth/login']);
  }
}