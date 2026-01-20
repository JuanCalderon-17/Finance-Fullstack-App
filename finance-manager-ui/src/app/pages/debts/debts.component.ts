import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DebtsService, Debt } from '../../services/debts.service';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit {

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

  constructor(private debtsService: DebtsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.debtsService.getDebts().subscribe({
      next: (data) => {
        this.debts = data.map(d => this.calculateMetrics(d));
        this.calculateTotal();
      }
    });
  }

  // 🧮 ZONA MATEMÁTICA - ACTUALIZADA
  calculateMetrics(debt: Debt): any {
    const d = { ...debt } as any;
    
    // ✅ NUEVO: Calcular paidInstallments desde installmentsList
    if (d.installmentsList && d.installmentsList.length > 0) {
      d.paidInstallments = d.installmentsList.filter((i: any) => i.isPaid).length;
    }

    // Cálculo de cuota mensual
    if (d.interestRate > 0) {
       const r = d.interestRate / 12 / 100;
       const n = d.installments;
       const numerator = r * Math.pow(1 + r, n);
       const denominator = Math.pow(1 + r, n) - 1;
       d.monthlyPayment = d.balance * (numerator / denominator);
    } else {
       d.monthlyPayment = d.balance / (d.installments || 1);
    }

    // Progreso
    d.progress = (d.paidInstallments / d.installments) * 100;
    
    // Saldo Restante Real
    const remainingInstallments = d.installments - d.paidInstallments;
    d.remainingAmount = remainingInstallments * d.monthlyPayment;

    return d;
  }

  calculateTotal() {
    this.totalDebt = this.debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  }

  saveDebt() {
    if (!this.currentDebt.name || this.currentDebt.balance <= 0) return;

    if (this.isEditing && this.currentDebt.id) {
      this.debtsService.updateDebt(this.currentDebt.id, this.currentDebt).subscribe({
        next: () => {
          this.loadData();
          this.resetForm();
        }
      });
    } else {
      this.debtsService.createDebt(this.currentDebt).subscribe({
        next: () => {
          this.loadData();
          this.resetForm();
        }
      });
    }
  }

  startEdit(debt: Debt) {
    this.isEditing = true;
    this.currentDebt = { ...debt };
    window.scrollTo(0, 0);
  }

  deleteDebt(id: number) {
    if(confirm('¿Borrar esta deuda?')) {
      this.debtsService.deleteDebt(id).subscribe({
        next: () => this.loadData()
      });
    }
  }



  // ✅ NUEVO: Toggle de cuota individual
  toggleInstallment(debtId: number, installmentId: number) {
    this.debtsService.toggleInstallment(debtId, installmentId).subscribe({
      next: () => this.loadData()
    });
  }

  resetForm() {
    this.isEditing = false;
    this.currentDebt = {
      name: '', balance: 0, interestRate: 0, installments: 12, paidInstallments: 0,
      color: '#ff416c', icon: 'bi-credit-card'
    };
  }
}