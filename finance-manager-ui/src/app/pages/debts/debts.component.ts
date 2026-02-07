import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DebtsService, Debt } from '../../services/debts.service';
import { CurrencyStateService } from '../../core/services/currency-state.service'; 
import { TranslateModule } from '@ngx-translate/core';
import { TransactionService } from '../../core/services/transaction.service';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit {

  currencySymbol: string = '$';
  exchangeRate: number = 1;
  debts: any[] = [];
  isEditing: boolean = false;
  
  currentDebt: Debt = {
    name: '',
    balance: 0,
    interestRate: 0,
    installments: 12,
    paidInstallments: 0,
    color: '#ff416c',
    icon: 'bi-credit-card'
  };

  totalDebt: number = 0;

  constructor(private debtsService: DebtsService, private currencyStateService : CurrencyStateService, private translateService: TransactionService) {}

  ngOnInit(): void {
    this.currencyStateService.currency$.subscribe(currency => {
      this.currencySymbol = currency.symbol;
      this.exchangeRate = currency.rate;
    })
    this.loadData();
  }

  loadData() {
    this.debtsService.getDebts().subscribe({
      next: (data) => {
        this.debts = data.map(d => this.calculateMetrics(d));
        this.calculateTotal();
      },
      error: (err) => {
        console.error('Error al cargar deudas:', err);
      }
    });
  }
  convertAmount(acc: Debt) : number {
    const accountCurrency = (acc.currency || 'USD').trim()
    const targetCurrency = this.currencyStateService.getCurrentCurrency().code.trim();

    if(accountCurrency === targetCurrency) {
      return acc.balance; 
    }

    //usd to brl
    if(accountCurrency === 'USD' && targetCurrency === 'BRL') {
      return acc.balance * this.exchangeRate;
    }

     //brl to usd
    if(accountCurrency === 'BRL' && targetCurrency === 'USD') {
      return acc.balance / this.exchangeRate;
    }
     
    return acc.balance;
  }

  convertNumber(amount:number, fromCurrency: string = 'USD') : number {
    const targetCurrency = this.currencyStateService.getCurrentCurrency().code.trim();

    if(fromCurrency === targetCurrency) {
      return amount; 
    }

    if (fromCurrency === 'USD' && targetCurrency === 'BRL') {
      return amount * this.exchangeRate;
    }

     if (fromCurrency === 'BRL' && targetCurrency === 'USD') {
      return amount / this.exchangeRate;
    }

    return amount;
  }

  // 🧮 CÁLCULOS FINANCIEROS
  calculateMetrics(debt: Debt): any {
    const d = { ...debt } as any;
    
    // Calcular cuotas pagadas desde la lista
    if (d.installmentsList && d.installmentsList.length > 0) {
      d.paidInstallments = d.installmentsList.filter((i: any) => i.isPaid).length;
    }

    // Calcular cuota mensual
    if (d.interestRate > 0) {
       const r = d.interestRate / 12 / 100;
       const n = d.installments;
       const numerator = r * Math.pow(1 + r, n);
       const denominator = Math.pow(1 + r, n) - 1;
       d.monthlyPayment = d.balance * (numerator / denominator);
    } else {
       d.monthlyPayment = d.balance / (d.installments || 1);
    }

    // Calcular progreso
    d.progress = (d.paidInstallments / d.installments) * 100;
    
    // Calcular saldo restante
    const remainingInstallments = d.installments - d.paidInstallments;
    d.remainingAmount = remainingInstallments * d.monthlyPayment;

    return d;
  }

  calculateTotal() {
  this.totalDebt = this.debts.reduce((sum, d) => {
    const convertedAmount = this.convertNumber(d.remainingAmount, d.currency); // Convertir el monto de cada deuda según su moneda

    return sum + convertedAmount;
  }, 0);
}

  // 💾 GUARDAR DEUDA (CREAR O EDITAR)
  saveDebt() {
    if (!this.currentDebt.name || this.currentDebt.balance <= 0) {
      alert('Completa todos los campos requeridos');
      return;
    }

    if (this.isEditing && this.currentDebt.id) {
      // MODO EDICIÓN
      this.debtsService.updateDebt(this.currentDebt.id, this.currentDebt).subscribe({
        next: () => {
          console.log('✓ Deuda actualizada');
          this.loadData();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error al actualizar:', err);
          alert('No se pudo actualizar la deuda');
        }
      });
    } else {
      // MODO CREACIÓN
      this.debtsService.createDebt(this.currentDebt).subscribe({
        next: () => {
          console.log('✓ Deuda creada');
          this.loadData();
          this.resetForm();
        },
        error: (err) => {
          console.error('Error al crear:', err);
          alert('No se pudo crear la deuda');
        }
      });
    }
  }

  // ✏️ INICIAR EDICIÓN
  startEdit(debt: Debt) {
    this.isEditing = true;
    this.currentDebt = { ...debt };
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // 🗑️ ELIMINAR DEUDA
  deleteDebt(id: number) {
    if (confirm('¿Estás seguro de eliminar esta deuda? Esta acción no se puede deshacer.')) {
      this.debtsService.deleteDebt(id).subscribe({
        next: () => {
          console.log('✓ Deuda eliminada');
          this.loadData();
        },
        error: (err) => {
          console.error('Error al eliminar:', err);
          alert('No se pudo eliminar la deuda');
        }
      });
    }
  }

  // ✅ MARCAR CUOTA COMO PAGADA/NO PAGADA
  toggleInstallment(debtId: number, installmentId: number) {
    this.debtsService.toggleInstallment(debtId, installmentId).subscribe({
      next: () => {
        console.log('✓ Estado de cuota actualizado');
        this.loadData();
      },
      error: (err) => {
        console.error('Error al cambiar estado:', err);
        alert('No se pudo actualizar el estado de la cuota');
      }
    });
  }

  // 💰 ACTUALIZAR MONTO DE CUOTA
  updateInstallmentAmount(debtId: number, installmentId: number, newAmount: number) {
    // Validaciones
    if (newAmount <= 0) {
      alert('El monto debe ser mayor a 0');
      this.loadData(); // Recargar para restaurar valor anterior
      return;
    }

    if (newAmount > 999999) {
      alert('El monto es demasiado alto');
      this.loadData();
      return;
    }

    // Actualizar en el backend
    this.debtsService.updateInstallment(debtId, installmentId, { amount: newAmount }).subscribe({
      next: () => {
        console.log('✓ Monto de cuota actualizado');
        this.loadData();
      },
      error: (err) => {
        console.error('Error al actualizar monto:', err);
        alert('No se pudo actualizar el monto de la cuota');
        this.loadData(); // Recargar para restaurar valor anterior
      }
    });
  }

  // 📅 VERIFICAR SI UNA CUOTA ESTÁ VENCIDA
  isOverdue(dueDate: string): boolean {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalizar a medianoche
    
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    
    return due < today;
  }

  // 🔄 RESETEAR FORMULARIO
  resetForm() {
    this.isEditing = false;
    this.currentDebt = {
      name: '', 
      balance: 0, 
      interestRate: 0, 
      installments: 12, 
      paidInstallments: 0,
      color: '#ff416c', 
      icon: 'bi-credit-card'
    };
  }
}