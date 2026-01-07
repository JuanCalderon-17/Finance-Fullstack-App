import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
// 👇 IMPORTANTE: Importamos el servicio y la interfaz
import { SavingsService, SavingAccount } from '../../services/savings.service';

@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './savings.component.html',
  styleUrls: ['./savings.component.scss']
})
export class SavingsComponent implements OnInit {

  accounts: SavingAccount[] = [];
  
  newAccount: SavingAccount = {
    name: '',
    balance: 0,
    color: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    icon: 'bi-bank'
  };

  totalSavings: number = 0;

  // 👇 Inyectamos el servicio aquí
  constructor(private savingsService: SavingsService) {}

  ngOnInit(): void {
    this.loadData();
  }

  // --- CONEXIÓN CON EL BACKEND (BD) ---

  loadData() {
    // Pedimos los datos a la base de datos
    this.savingsService.getSavings().subscribe({
      next: (data) => {
        this.accounts = data;
        this.calculateTotal();
      },
      error: (err) => console.error('Error cargando ahorros', err)
    });
  }

  calculateTotal() {
    this.totalSavings = this.accounts.reduce((sum, acc) => sum + acc.balance, 0);
  }

  addAccount() {
    if (!this.newAccount.name) return;
    
    // 1. Preparamos el objeto limpio para enviar
    const savingToSend: SavingAccount = {
      name: this.newAccount.name,
      balance: this.newAccount.balance || 0, // Asegura que sea número
      color: this.newAccount.color,
      icon: this.newAccount.icon,
      // No enviamos 'Goal' ni 'Id' ni 'isEditing'
    };

    // 2. Enviamos a la Base de Datos
    this.savingsService.createSaving(savingToSend).subscribe({
      next: (savedAccount) => {
        // Éxito: Agregamos a la lista local
        this.accounts.push({ ...savedAccount, isEditing: false });
        this.calculateTotal();
        
        // Reset form
        this.newAccount = { name: '', balance: 0, color: '#ffffff', icon: 'bi-bank' };
      },
      error: (err) => {
        console.error('Error creando cuenta', err);
        // Tip: Si puedes, imprime err.error para ver qué campo falla
        if(err.error && err.error.errors) {
            console.log("Detalles del error:", err.error.errors); 
        }
      }
    });
  }

  deleteAccount(index: number) {
    const account = this.accounts[index];
    if(!account.id) return; // Si no tiene ID no podemos borrar de la BD

    if(confirm('¿Seguro que quieres borrar esta cuenta?')) {
      this.savingsService.deleteSaving(account.id).subscribe({
        next: () => {
          this.accounts.splice(index, 1);
          this.calculateTotal();
        },
        error: (err) => console.error('Error borrando', err)
      });
    }
  }

  // Actualizar Saldo o Editar Nombre en la BD
  updateSavingInDb(account: SavingAccount) {
    if(!account.id) return;

    this.savingsService.updateSaving(account.id, account).subscribe({
      next: () => {
        this.calculateTotal();
        account.isEditing = false; // Salir modo edición
      },
      error: (err) => console.error('Error actualizando', err)
    });
  }

  // --- LÓGICA DE UI ---

  updateBalance(account: SavingAccount, amount: number) {
    account.balance += amount;
    if(account.balance < 0) account.balance = 0;
    
    // Guardamos el nuevo saldo en la BD automáticamente
    this.updateSavingInDb(account);
  }

  enableEdit(account: SavingAccount) {
    account.isEditing = true;
  }

  saveEdit(account: SavingAccount) {
    this.updateSavingInDb(account);
  }
}