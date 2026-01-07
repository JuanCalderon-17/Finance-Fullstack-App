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

  // La lista ahora viene vacía, esperaremos a que llegue de la base de datos
  debts: Debt[] = [];

  // Configuración para nueva deuda (Coincide con tu Backend)
  newDebt: Debt = {
    name: '',
    balance: 0,
    color: '#ff416c', // Color rojo por defecto para deudas
    icon: 'bi-credit-card'
  };

  totalDebt: number = 0;

  // Inyectamos el servicio en el constructor
  constructor(private debtsService: DebtsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  // --- CONEXIÓN CON EL BACKEND ---

  loadData() {
    this.debtsService.getDebts().subscribe({
      next: (data) => {
        this.debts = data;
        this.calculateTotal();
      },
      error: (err) => console.error('Error cargando deudas:', err)
    });
  }

  calculateTotal() {
    // Suma simple de todos los balances
    this.totalDebt = this.debts.reduce((sum, debt) => sum + debt.balance, 0);
  }

  addDebt() {
    // Validaciones básicas
    if (!this.newDebt.name || this.newDebt.balance <= 0) return;

    // 🛡️ Preparamos el objeto LIMPIO para enviar al backend
    // Esto evita errores si Angular agrega propiedades extra
    const debtToSend: Debt = {
      name: this.newDebt.name,
      balance: this.newDebt.balance,
      color: this.newDebt.color,
      icon: this.newDebt.icon
    };

    // Enviamos a la nube
    this.debtsService.createDebt(debtToSend).subscribe({
      next: (savedDebt) => {
        // Éxito: Lo agregamos a la lista visual
        this.debts.push(savedDebt);
        this.calculateTotal();

        // Limpiamos el formulario
        this.newDebt = { 
          name: '', 
          balance: 0, 
          color: '#ff416c', 
          icon: 'bi-credit-card' 
        };
      },
      error: (err) => console.error('Error creando deuda:', err)
    });
  }

  deleteDebt(index: number) {
    const debtToDelete = this.debts[index];

    // Necesitamos el ID para borrarlo de la base de datos
    if (!debtToDelete.id) return;

    if(confirm(`¿Ya pagaste la deuda "${debtToDelete.name}"? ¿Borrarla?`)) {
      this.debtsService.deleteDebt(debtToDelete.id).subscribe({
        next: () => {
          // Si el backend dice OK, lo borramos de la lista visual
          this.debts.splice(index, 1);
          this.calculateTotal();
        },
        error: (err) => console.error('Error borrando deuda:', err)
      });
    }
  }
}