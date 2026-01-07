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
  isEditing: boolean = false; // ¿Estamos editando?
  
  // Modelo para el formulario (Nuevo o Edición)
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
        // Calculamos los datos visuales para cada deuda que llega
        this.debts = data.map(d => this.calculateMetrics(d));
        this.calculateTotal();
      }
    });
  }

  // 🧮 ZONA MATEMÁTICA
  calculateMetrics(debt: Debt): any {
    const d = { ...debt } as any; // Copia extensible
    
    // Cálculo de cuota simple (con interés compuesto básico si existe)
    if (d.interestRate > 0) {
       const r = d.interestRate / 12 / 100; // Tasa mensual
       const n = d.installments;
       // Fórmula de anualidad
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

  // --- ACCIONES ---

  saveDebt() {
    if (!this.currentDebt.name || this.currentDebt.balance <= 0) return;

    if (this.isEditing && this.currentDebt.id) {
      // MODO EDICIÓN
      this.debtsService.updateDebt(this.currentDebt.id, this.currentDebt).subscribe({
        next: () => {
          this.loadData();
          this.resetForm();
        }
      });
    } else {
      // MODO CREACIÓN
      this.debtsService.createDebt(this.currentDebt).subscribe({
        next: () => {
          this.loadData();
          this.resetForm();
        }
      });
    }
  }

  // Cargar datos en el formulario para editar
  startEdit(debt: Debt) {
    this.isEditing = true;
    this.currentDebt = { ...debt }; // Copia para no modificar la lista directamente
    window.scrollTo(0, 0); // Subir para ver el form
  }

  deleteDebt(id: number) {
    if(confirm('¿Borrar esta deuda?')) {
      this.debtsService.deleteDebt(id).subscribe({
        next: () => this.loadData()
      });
    }
  }

  // Slider en tiempo real
  onSliderChange(debt: any, newValue: number) {
    debt.paidInstallments = newValue;
    // Guardamos el cambio en la BD automáticamente al soltar el slider (opcional)
    // O simplemente actualizamos visualmente:
    const updated = this.calculateMetrics(debt);
    Object.assign(debt, updated);
    
    // Si quieres guardar en BD cada vez que mueven el slider:
    // this.debtsService.updateDebt(debt.id, debt).subscribe();
  }
  
  // Guardar el cambio del slider al soltarlo
  saveSliderChange(debt: any) {
     if(debt.id) {
         this.debtsService.updateDebt(debt.id, debt).subscribe();
     }
  }

  resetForm() {
    this.isEditing = false;
    this.currentDebt = {
      name: '', balance: 0, interestRate: 0, installments: 12, paidInstallments: 0,
      color: '#ff416c', icon: 'bi-credit-card'
    };
  }
}