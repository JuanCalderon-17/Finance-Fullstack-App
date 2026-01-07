import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
// 👇 Importamos la interfaz correcta del servicio
import { DebtsService, Debt } from '../../services/debts.service';

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit {

  // Usamos 'any' aquí para que no se queje si el HTML pide propiedades extra como 'progress'
  debts: any[] = [];

  // Objeto que COINCIDE con tu formulario HTML
  newDebt: any = {
    name: '',
    totalAmount: 0,      // Tu HTML usa esto
    interestRate: 0,     // Tu HTML usa esto
    installments: 12,    // Tu HTML usa esto
    paidInstallments: 0
  };

  totalDebt: number = 0;

  constructor(private debtsService: DebtsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  loadData() {
    this.debtsService.getDebts().subscribe({
      next: (data) => {
        // TRUCO: Convertimos los datos del Backend para que tu HTML los entienda
        this.debts = data.map(d => ({
          ...d,
          totalAmount: d.balance, // El backend manda 'balance', lo mostramos como 'totalAmount'
          // Valores visuales por defecto (ya que la BD no los guarda aún)
          interestRate: 0,
          installments: 1,
          progress: 0
        }));
        this.calculateTotal();
      },
      error: (err) => console.error('Error cargando deudas:', err)
    });
  }

  calculateTotal() {
    this.totalDebt = this.debts.reduce((sum, debt) => sum + (debt.balance || 0), 0);
  }

  addDebt() {
    // Validamos usando el campo del HTML (totalAmount)
    if (!this.newDebt.name || this.newDebt.totalAmount <= 0) return;

    // 🛡️ Preparamos el objeto para enviar al Backend
    // Aquí traducimos 'totalAmount' -> 'balance'
    const debtToSend: Debt = {
      name: this.newDebt.name,
      balance: this.newDebt.totalAmount, 
      color: '#ff416c',
      icon: 'bi-credit-card'
    };

    this.debtsService.createDebt(debtToSend).subscribe({
      next: (savedDebt) => {
        // Agregamos a la lista visualmente
        this.debts.push({
          ...savedDebt,
          totalAmount: savedDebt.balance, // Mapeo inmediato
          progress: 0
        });
        
        this.calculateTotal();

        // Limpiamos el formulario
        this.newDebt = { 
          name: '', 
          totalAmount: 0, 
          interestRate: 0, 
          installments: 12, 
          paidInstallments: 0 
        };
      },
      error: (err) => console.error('Error creando deuda:', err)
    });
  }

  deleteDebt(index: number) {
    const debt = this.debts[index];
    
    // Necesitamos el ID real de la base de datos
    if (!debt.id) return;

    if(confirm('¿Seguro que quieres borrar esta deuda?')) {
      this.debtsService.deleteDebt(debt.id).subscribe({
        next: () => {
          this.debts.splice(index, 1);
          this.calculateTotal();
        },
        error: (err) => console.error('Error borrando:', err)
      });
    }
  }
}