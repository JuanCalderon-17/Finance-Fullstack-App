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
    originalBalance: 0,
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
      // Re-derive the editable installment inputs in the new display currency
      for (const d of this.debts) {
        for (const i of d.installmentsList || []) {
          i.displayAmount = this.roundMoney(this.convertNumber(i.amount, d.currency));
        }
      }
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
    return this.currencyStateService.convert(acc.originalBalance, acc.currency || 'USD');
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

    const allInstallments: any[] = d.installmentsList || [];

    // Next unpaid installment amount
    const nextUnpaid = allInstallments
      .filter((i: any) => !i.isPaid)
      .sort((a: any, b: any) => a.installmentNumber - b.installmentNumber)[0];
    d.nextPayment = nextUnpaid ? nextUnpaid.amount : 0;

    // Actual money paid = sum of amounts on installments marked paid
    const paidAmount = allInstallments
      .filter((i: any) => i.isPaid)
      .reduce((s: number, i: any) => s + i.amount, 0);
    d.paidAmount = paidAmount;

    // Total to pay = sum of ALL installments. This includes interest and any
    // manually edited amounts, so it is the real target — not originalBalance,
    // which is principal only and understates interest-bearing debts.
    const totalInstallmentAmount = allInstallments.reduce((s: number, i: any) => s + i.amount, 0);
    const totalToPay = allInstallments.length > 0 ? totalInstallmentAmount : d.originalBalance;
    d.totalToPay = totalToPay;

    const rawRemaining = totalToPay - paidAmount;
    d.remainingAmount = Math.max(0, rawRemaining);

    // Overpayment indicator
    d.isOverpaid = rawRemaining < -0.01;
    d.overpaidAmount = d.isOverpaid ? Math.abs(rawRemaining) : 0;

    // Paid-in-full = every installment settled (or the money target reached)
    const allPaid = allInstallments.length > 0 && allInstallments.every((i: any) => i.isPaid);
    d.isPaidInFull = allPaid || rawRemaining <= 0.01;

    d.progress = totalToPay > 0
      ? Math.min(100, (paidAmount / totalToPay) * 100)
      : 0;

    // "Adjusted" only when the schedule drifted from what the debt's own terms
    // predict (manual edits) — interest alone is expected, not an adjustment.
    d.hasDelta = allInstallments.length > 0 &&
      Math.abs(totalInstallmentAmount - this.expectedTotal(d)) > 0.05;

    // Pending installment inputs are edited in the active display currency
    for (const i of allInstallments) {
      i.displayAmount = this.roundMoney(this.convertNumber(i.amount, d.currency));
    }

    return d;
  }

  // Mirrors the backend amortization in DebtsController.GenerateInstallments
  private expectedTotal(d: any): number {
    if (!(d.interestRate > 0) || !(d.installments > 0)) return d.originalBalance;
    const r = d.interestRate / 12 / 100;
    const factor = Math.pow(1 + r, d.installments);
    const monthly = d.originalBalance * (r * factor) / (factor - 1);
    return this.roundMoney(monthly * d.installments);
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  calculateTotal() {
  this.totalDebt = this.debts.reduce((sum, d) => {
    const convertedAmount = this.convertNumber(d.remainingAmount, d.currency); // Convertir el monto de cada deuda según su moneda

    return sum + convertedAmount;
  }, 0);
}

  // save debt, create or update
  saveDebt() {
  if (!this.currentDebt.name || this.currentDebt.originalBalance <= 0) {
    alert('Complete all the required fields');
    return;
  }

  const debtToSave = { ...this.currentDebt };

  if (this.currencyCode === 'BRL') {
    debtToSave.originalBalance = this.currentDebt.originalBalance / this.exchangeRate;
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
    this.currentDebt.originalBalance = this.currencyStateService.convert(debt.originalBalance, 'USD');
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

  // mark installment as paid or not paid.
  // Sends the current (possibly edited) amount AND the paid flag in ONE request,
  // so the backend rebalances atomically. Two separate calls (blur-save the
  // amount, then a toggle) raced, and the remaining installments never
  // recalculated because neither request saw the combined "new amount + paid".
  setInstallmentPaid(debt: any, inst: any) {
    const newPaid = !inst.isPaid;

    // inst.displayAmount is edited in the active currency; the backend stores USD.
    let amountUsd = Number(inst.displayAmount);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) amountUsd = inst.amount;
    if (this.currencyCode === 'BRL' && this.exchangeRate > 0) amountUsd = amountUsd / this.exchangeRate;
    amountUsd = this.roundMoney(amountUsd);

    this.debtsService.updateInstallment(debt.id, inst.id, { amount: amountUsd, isPaid: newPaid }).subscribe({
      next: () => {
        this.loadData();
      },
      error: (err) => {
        console.error('Error al cambiar estado:', err);
        alert('No se pudo actualizar el estado de la cuota');
        this.loadData();
      }
    });
  }

  //update amount of installment
  // newAmount arrives in the active display currency; storage is always USD
  updateInstallmentAmount(debtId: number, installmentId: number, newAmount: number) {
    // Validaciones
    if (newAmount <= 0) {
      alert('El monto debe ser mayor a 0');
      this.loadData();
      return;
    }

    if (newAmount > 999999) {
      alert('El monto es demasiado alto');
      this.loadData();
      return;
    }

    let amountUsd = newAmount;
    if (this.currencyCode === 'BRL') {
      amountUsd = newAmount / this.exchangeRate;
    }
    amountUsd = this.roundMoney(amountUsd);

    //update in the backend
    this.debtsService.updateInstallment(debtId, installmentId, { amount: amountUsd }).subscribe({
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

  // verify is installment is overdue 
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
      originalBalance: 0,
      currency: this.currencyCode,
      interestRate: 0,
      installments: 12,
      paidInstallments: 0,
      color: '#ff416c',
      icon: 'bi-credit-card'
    };
  }
}