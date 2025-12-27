import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; // Importante para usar *ngFor
import { FormsModule } from '@angular/forms';
import { TransactionService } from '../core/services/transaction.service';
import { Transaction } from '../shared/models/transaction.model';
import { Router, RouterLink } from '@angular/router'
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, BaseChartDirective, RouterLink], 
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  
  allTransactions: Transaction[] = [];   // Aquí guardo la lista de transacciones que lleguen del backend
  filteredTransactions: Transaction[] = []; // Aquí guardamos solo lo del MES SELECCIONADO, esto es para filtrar
  incomeCategories: string[] = ['Sueldo', 'Negocio', 'Venta', 'Ingreso Extra']; // defino que es un ingreso


  //objetivo para formularios new
  newTransaction: any = {
    description: '',
    amount: 0,
    category: 'Comida',
    transactionDate: new Date().toISOString().slice(0, 10)//fecha de hoy
  }


  //propiedad para el pieChart
  public pieChartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false, // Para que se adapte al contenedor
    plugins: {
      legend: {
        position: 'right', // Leyenda a la derecha
      }
    }
  };
  public pieChartType: ChartType = 'pie'; //tipo pastel 

  public pieChartData: ChartData<'pie', number[], string | string[]> = {
    labels: [],
    datasets: [{ data: []}]
  };


  // VARIABLES PARA EL FILTRO DE FECHA
  selectedMonth: number;
  selectedYear: number;
  years: number[] = []; // Para llenar el select de años dinámicamente
  selectedPeriod: string = 'all'; //variable para la quincena


  //these are variables for UI (totales, alertas, edición...)
  totalSpent: number = 0;
  totalIncome: number = 0;
  alertMessage: string = "";
  alertColor: string = 'green';
  isEditing : boolean = false;
  editingId : number | null = null;
  currencyCode : string = 'USD'; //iniciamos en dolares
  currencySymbol : string = '$';
  exchangeRate : number = 1;
  readonly USD_TO_BRL_RATE = 6.5; //tasa de conversion


  constructor(private transactionService: TransactionService, private router: Router) { 
    const today = new Date();  // Inicializamos el filtro con la fecha de HOY
    this.selectedMonth = today.getMonth(); // 0 = Enero, 11 = Diciembre
    this.selectedYear = today.getFullYear();

    // Genera años para el selector 
    for(let i = 2025; i <= 2026; i++ ) {
      this.years.push(i);
    }
  }
  
  
  // ngOnInit se ejecuta cuando el componente "nace"
  ngOnInit(): void {
    this.loadTransactions();
  }


  toggleCurrency() {
    if( this.currencyCode === 'USD') {
      this.currencyCode  = 'BRL';
      this.currencySymbol = 'R$';
      this.exchangeRate = this.USD_TO_BRL_RATE;
    }
    else {
      //si ya estamos en BRL, volvemos a Dolares
      this.currencyCode  = 'USD';
      this.currencySymbol = '$';
      this.exchangeRate = 1;
    }
  }


  loadTransactions() {
    this.transactionService.getTransactions().subscribe({
      next: (data) => {
        this.allTransactions = data;// Guardamos la copia maestra
        this.applyFilters();// Aplicamos el filtro inmediatamente para mostrar el mes actual
      },
      error: (err) => {
        console.error('Error al cargar transacciones:', err);
      }
    });
  }

  applyFilters() {
    this.filteredTransactions = this.allTransactions.filter(t => {
      const date = new Date(t.transactionDate);
      const day = date.getDate() + 1;
      // Vamos a usar la fecha tal cual viene del string para evitar problemas de zona horaria 
      const transactionDay = parseInt(t.transactionDate.toString().slice(8,10));
      const matchesMonthYear =  date.getMonth() === +this.selectedMonth && 
                                date.getFullYear() === +this.selectedYear;

      if (!matchesMonthYear) return false;

      // Filtro de Quincena
      if(this.selectedPeriod === 'all') {
        return true; //para ver todo lo que pasa
      } else if (this.selectedPeriod === '1') {
        return transactionDay <= 15; // Días 1 al 15
      } else {
        return transactionDay > 15; // Días 16 en adelante
      }
    });

    this.calculateStats();// Recalcular dinero y alertas
  }


  calculateStats() {
    this.totalSpent = 0;
    this.totalIncome = 0;

    // 1. Sumamos todo (en Dólares, que es como viene de la BD)
    this.filteredTransactions.forEach(t => {
      if (this.incomeCategories.includes(t.category)) {
        this.totalIncome += t.amount;
      } else {
        this.totalSpent += t.amount;
      }
    });
    
    // 2. Calculamos el límite con el margen del 10%
    const limitWithBuffer = this.totalIncome * 1.10; 

    // 3. Decidimos el color del semáforo
    if (this.totalSpent <= this.totalIncome) {
      this.alertMessage = "Vamos bien. ¡Estás dentro de tus posibilidades!";
      this.alertColor = 'green';
    } else if (this.totalSpent > this.totalIncome && this.totalSpent <= limitWithBuffer) {
      const diff = (this.totalSpent - this.totalIncome) * this.exchangeRate; // Opcional: mostrar diff ajustada
      this.alertMessage = `Cuidado: Te has pasado un poco. ¡Frena los gastos!`;
      this.alertColor = 'orange';
    } else {
      this.alertMessage = '¡ALERTA ROJA! Has superado tu límite de seguridad del 10%.';
      this.alertColor = 'red';
    }

    this.updateChart();
  }




  updateChart() {
    const categoryTotals: any = {};// Agrupamos los gatos, tipo "Comida": 150, "Transporte": 50 

    this.filteredTransactions.forEach(t => {
      // Si la categoría no existe en el acumulador, la inicializamos
      if(!this.incomeCategories.includes(t.category)) {

        if(!categoryTotals[t.category]) {
          categoryTotals[t.category] = 0;
        }
        //Sumamo el monto
        categoryTotals[t.category] += t.amount;
      }
    })

    // Extraemos las llaves Categorías y valores Montos
    const labels = Object.keys(categoryTotals)
    const data = Object.values(categoryTotals) as number[];

    // Asignamos al gráfico
    this.pieChartData = {
      labels: labels,
      datasets: [{
        data: data,
        // 🎨 NUEVA PALETA "DARK MODE GLOW"
        backgroundColor: [
          '#00d2d3', // Cyan Neón (Transporte?) - Se ve increíble en negro
          '#ff9f43', // Naranja Brillante (Comida?)
          '#5f27cd', // Violeta Eléctrico (Ocio?)
          '#ff6b6b', // Rojo Coral (Salud/Casa?)
          '#10ac84', // Verde Matrix (Ahorro - ¡Este debe destacar!)
          '#2e86de', // Azul Rey
          '#f368e0', // Rosa Fucsia
          '#feca57'  // Amarillo Sol
        ],
        // Quitamos el borde blanco feo que separa las rebanadas
        borderColor: '#1a1a2e', // El mismo color que tu fondo oscuro
        borderWidth: 2
      }]
    };
  }  

  //Función para agregar transacciones
  addTransaction() {
    this.newTransaction.amount = Number(this.newTransaction.amount); // Convertimos el monto a número por si acaso

    if (!this.newTransaction.description || this.newTransaction.description.trim() === '') {
      alert('⚠️Porfavor agrega una descripción para el movimiento.')
      return; 
    }

    if (!this.newTransaction.amount || this.newTransaction.amount <= 0) {
      alert('⚠️ El monto debe ser mayor a 0.')
      return;
    }

    if (this.isEditing && this.editingId) {
      this.transactionService.updateTransaction(this.editingId, this.newTransaction).subscribe({
        next: () => {
          this.loadTransactions();// Recargar lista
          this.cancelEdit(); // Limpiar formulario y salir del modo edición
          console.log('Actualizado con exito!');
        },
        error: (err) => console.error('Error al actualizar:', err)
      });
    }
    else {
      this.transactionService.createTransaction(this.newTransaction).subscribe({
        next: (res) => {
          console.log('Transacción creada!', res);
          // ¡Truco! Recargamos la lista para ver el cambio inmediatamente
          this.loadTransactions();
          this.newTransaction.description = '';
          this.newTransaction.amount = 0;
          this.cancelEdit(); // Usamos esto para limpiar también
        },
        error: (err) => console.error('Error al crear:', err)
      });
    }
  }


  edit(transaction: Transaction) {
  this.isEditing = true;
  this.editingId = transaction.id;
  
  // Copiamos los datos al formulario
  // Usamos {...transaction} para crear una copia y no modificar la tabla en tiempo real
  this.newTransaction = { ...transaction }; 
  }
  

  cancelEdit() {
    this.isEditing = false;
    this.editingId = null;
    this.newTransaction = { 
      description: '', 
      amount: 0, 
      category: 'Comida', 
      transactionDate: new Date().toISOString().slice(0, 10) 
    };
  }


  deleteTransaction(id: number) {
    if (confirm('¿Estás seguro de que quieres eliminar esta transacción?')) {
      // Corregí el typo: deleteTrasaction -> deleteTransaction
      this.transactionService.deleteTransaction(id).subscribe({
        next: () => {
          console.log('Transacción eliminada con éxito:', id);
          this.loadTransactions();
        },
        error: (err) => console.error('Error al eliminar', err)
      });
    }
  }


  logout() {
    localStorage.removeItem('user'); //para borrar token
    this.router.navigate(['/auth/login']); //mandamos al usuario al login
  }

}
