import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SavingsService, SavingAccount } from '../../services/savings.service';
import { CurrencyStateService } from '../../core/services/currency-state.service'; 
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TutorialService } from '../../core/services/tutorial.service';


@Component({
  selector: 'app-savings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './savings.component.html',
  styleUrls: ['./savings.component.scss']
})
export class SavingsComponent implements OnInit {

  currencySymbol: string = '$';
  exchangeRate: number = 1;
  accounts: SavingAccount[] = [];
  
  newAccount: SavingAccount = {
    name: '',
    balance: 0,
    color: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    icon: 'bi-bank'
  };

  totalSavings: number = 0;

  constructor(private savingsService: SavingsService, 
              private currencyStateService: CurrencyStateService, 
              private translateService: TranslateService,
               private tutorialService: TutorialService) {}

  ngOnInit(): void {
    this.currencyStateService.currency$.subscribe(currency => {
      this.currencySymbol = currency.symbol;
      this.exchangeRate = currency.rate;
    });
    this.loadData();
    setTimeout(() => {
      if (this.tutorialService.shouldShowSavingsTutorial()) {
        this.tutorialService.startSavingsTutorial();
      }
    }, 1000);
  }

  //CONEXIÓN CON EL BACKEND 

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

  convertAmount(acc: SavingAccount): number {
    const accountCurrency = (acc.currency || 'USD').trim();
    const targetCurrency = this.currencyStateService.getCurrentCurrency().code.trim();

    //same currency
    if(accountCurrency === targetCurrency) {
      return acc.balance
    }

    // usd => brl
    if(accountCurrency === 'USD' && targetCurrency === 'BRL') {
      return acc.balance * this.exchangeRate;
    }
    
    // brl => usd
    if(accountCurrency === 'BRL' && targetCurrency === 'USD') {
      return acc.balance / this.exchangeRate;
    }

    // witouth converting by default
    return acc.balance;

  }
  
  calculateTotal() {
    this.totalSavings = this.accounts.reduce((sum, acc) => {
      return sum + this.convertAmount(acc);
    }, 0)
  }

  addAccount() {
    if (!this.newAccount.name) return;
    
    // 1. Preparamos el objeto limpio para enviar
    const savingToSend: SavingAccount = {
      name: this.newAccount.name,
      balance: this.newAccount.balance || 0, // Asegura que sea número
      color: this.newAccount.color,
      icon: this.newAccount.icon,
      currency: this.currencyStateService.getCurrentCurrency().code
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

    if(confirm('SAVINGS.CONFIRM_DELETE')) {
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