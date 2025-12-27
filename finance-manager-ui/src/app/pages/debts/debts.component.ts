import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   
import { RouterLink } from '@angular/router';   

interface Debt {
  name: string;
  totalAmount: number;     // Cuánto pediste prestado
  interestRate: number;    // Interés Anual
  installments: number;    // Plazo en Meses 
  paidInstallments: number;
  
  // Propiedades calculadas 
  monthlyPayment?: number; 
  remainingAmount?: number;
  progress?: number;       
}

@Component({
  selector: 'app-debts',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink], 
  templateUrl: './debts.component.html',
  styleUrls: ['./debts.component.scss']
})
export class DebtsComponent implements OnInit {

  // Lista de deudas (Empezamos con una de ejemplo)
  debts: Debt[] = [
    { name: 'Préstamo Auto', totalAmount: 15000, interestRate: 12, installments: 48, paidInstallments: 10 },
    { name: 'Tarjeta Crédito', totalAmount: 2000, interestRate: 25, installments: 12, paidInstallments: 3 }
  ];

  // Objeto para el formulario de nueva deuda
  newDebt: Debt = {
    name: '',
    totalAmount: 0,
    interestRate: 0,
    installments: 12, // 1 año por defecto
    paidInstallments: 0
  };

  ngOnInit(): void {
    // Apenas carga la página, calculamos los números de todas las deudas
    this.calculateAll();
  }

  // ZONA DE MATEMÁTICAS FINANCIERAS ---

  calculateAll() {
    this.debts.forEach(debt => {
      this.calculateDebtMetrics(debt);
    });
  }

  calculateDebtMetrics(debt: Debt) {
    // 1. Calcular Cuota Mensual (Fórmula de Anualidad)
    // P = Monto
    // r = Tasa mensual (Interés Anual / 12 / 100)
    // n = Número de cuotas
    // Fórmula: M = P * [ r(1+r)^n ] / [ (1+r)^n – 1 ]
    
    if (debt.interestRate > 0) {
      const r = debt.interestRate / 12 / 100;
      const n = debt.installments;
      
      // Numerador y Denominador de la fórmula financiera
      const numerator = r * Math.pow(1 + r, n);
      const denominator = Math.pow(1 + r, n) - 1;
      
      debt.monthlyPayment = debt.totalAmount * (numerator / denominator);
    } else {
      // Si es prestamo de amigo (0% interés), es división simple
      debt.monthlyPayment = debt.totalAmount / debt.installments;
    }

    // 2. Calcular Saldo Restante Aproximado, (Total de cuotas - Cuotas pagadas) * Valor Cuota
    const remainingInstallments = debt.installments - debt.paidInstallments;
    debt.remainingAmount = remainingInstallments * (debt.monthlyPayment || 0);

    // Calcular Progreso 
    debt.progress = (debt.paidInstallments / debt.installments) * 100;
  }

  


  addDebt() {
    // Validaciones básicas
    if (!this.newDebt.name || this.newDebt.totalAmount <= 0) return;

    // Agregamos la nueva deuda a la lista,usamos { ...obj } para crear una copia y no referencias
    const debtToAdd = { ...this.newDebt };
    
    this.calculateDebtMetrics(debtToAdd); // Calculamos sus datos antes de guardar
    this.debts.push(debtToAdd);

    // Limpiamos el formulario
    this.newDebt = { name: '', totalAmount: 0, interestRate: 0, installments: 12, paidInstallments: 0 };
  }

  deleteDebt(index: number) {
    if(confirm('¿Borrar esta deuda?')) {
      this.debts.splice(index, 1);
    }
  }
}