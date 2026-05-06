import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DebtsService, Debt } from '../../services/debts.service';
import { CurrencyStateService } from '../../core/services/currency-state.service'; 
import { TranslateModule } from '@ngx-translate/core';
import { TutorialService } from '../../core/services/tutorial.service';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currencySymbol: string = '$';
  currencyCode: string = 'USD';
  exchangeRate: number = 1;
  debts: any[] = [];
  isEditing: boolean = false;
  
  currentDebt: Debt = {
    name: '',
    balance: 0,
    currency: 'USD',
    interestRate: 0,
    installments: 12,
    paidInstallments: 0,
    color: '#ff416c',
    icon: 'bi-credit-card'
  };

  totalDebt: number = 0;

  constructor(private debtsService: DebtsService,
              private currencyStateService : CurrencyStateService,
              private tutorialService: TutorialService) {}

  ngOnInit(): void {
    this.currencyStateService.currency$.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currencyCode = currency.code;
      this.currencySymbol = currency.symbol;
      this.exchangeRate = currency.rate;
      this.currentDebt.currency = currency.code;
    });
    this.loadData();

    setTimeout(() => {
    if (this.tutorialService.shouldShowDebtsTutorial()) { 
      this.tutorialService.startDebtsTutorial();
    }
    }, 2000);
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
  convertAmount(acc: Debt): number {
    return this.currencyStateService.convert(acc.balance, acc.currency || 'USD');
  }

  convertNumber(amount: number, fromCurrency: string = 'USD'): number {
    return this.currencyStateService.convert(amount, fromCurrency);
  }

  //  CÁLCULOS FINANCIEROS
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
    
    // Calcular saldo restante desde las cuotas reales, no desde la fórmula
    d.remainingAmount = (d.installmentsList || [])
      .filter((i: any) => !i.isPaid)
      .reduce((sum: number, i: any) => sum + i.amount, 0);

    return d;
  }

  calculateTotal() {
  this.totalDebt = this.debts.reduce((sum, d) => {
    const convertedAmount = this.convertNumber(d.remainingAmount, d.currency); // Convertir el monto de cada deuda según su moneda

    return sum + convertedAmount;
  }, 0);
}

  // save debt, create or update
  saveDebt() {
  if (!this.currentDebt.name || this.currentDebt.balance <= 0) {
    alert('Complete all the required fields');
    return;
  }

  const debtToSave = { ...this.currentDebt };

  if (this.currencyCode === 'BRL') {
    debtToSave.balance = this.currentDebt.balance / this.exchangeRate;
  }

  // MODO EDICIÓN
  if (this.isEditing && this.currentDebt.id) {
    this.debtsService.updateDebt(this.currentDebt.id, debtToSave).subscribe({
      next: () => {
        this.loadData();
        this.resetForm();
      },
      error: (err) => {
        console.error('Error at updating:', err);
        alert('Debt could not be updated');
      }
    });
  } 
  // MODO CREACIÓN
  else {
    this.debtsService.createDebt(debtToSave).subscribe({
      next: () => {
        this.loadData();
        this.resetForm();
      },
      error: (err) => {
        console.error('Error at creating:', err);
        alert('Debt could not be created');
      }
    });
  }
}

  // start editing
  startEdit(debt: Debt) {
    this.isEditing = true;
    this.currentDebt = { ...debt };
    // Show balance in user's active currency so the form value matches what they see
    this.currentDebt.balance = this.currencyStateService.convert(debt.balance, 'USD');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // delete debt
  deleteDebt(id: number) {
    if (confirm('¿Estás seguro de eliminar esta deuda? Esta acción no se puede deshacer.')) {
      this.debtsService.deleteDebt(id).subscribe({
        next: () => {
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

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // RESETEAR FORMULARIO
  resetForm() {
    this.isEditing = false;
    this.currentDebt = {
      name: '', 
      balance: 0, 
      currency: this.currencyCode,
      interestRate: 0, 
      installments: 12, 
      paidInstallments: 0,
      color: '#ff416c', 
      icon: 'bi-credit-card'
    };
  }
}