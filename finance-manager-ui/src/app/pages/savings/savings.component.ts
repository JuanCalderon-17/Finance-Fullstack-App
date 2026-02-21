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
  currencyCode: string = 'USD'; 
  exchangeRate: number = 1;
  accounts: SavingAccount[] = [];
  
  newAccount: SavingAccount = {
    name: '',
    balance: 0,
    color: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
    icon: 'bi-bank'
  };

  totalSavings: number = 0;

  constructor(
    private savingsService: SavingsService, 
    private currencyStateService: CurrencyStateService, 
    private translateService: TranslateService,
    private tutorialService: TutorialService
  ) {}

  ngOnInit(): void {
    this.currencyStateService.currency$.subscribe(currency => {
      this.currencyCode = currency.code;  
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

  loadData() {
    this.savingsService.getSavings().subscribe({
      next: (data) => {
        this.accounts = data;
        this.calculateTotal();
      },
      error: (err) => console.error('Error cargando ahorros', err)
    });
  }

  // Backend siempre devuelve USD
  convertAmount(acc: SavingAccount): number {
    const accountCurrency = (acc.currency || 'USD').trim(); // Backend siempre USD
    const targetCurrency = this.currencyCode.trim(); // Lo que ve el usuario

    // Mismo currency
    if (accountCurrency === targetCurrency) {
      return acc.balance;
    }

    // USD (backend) → BRL (usuario)
    if (accountCurrency === 'USD' && targetCurrency === 'BRL') {
      return acc.balance * this.exchangeRate;
    }

    // BRL → USD (no debería pasar)
    if (accountCurrency === 'BRL' && targetCurrency === 'USD') {
      return acc.balance / this.exchangeRate;
    }

    return acc.balance;
  }
  
  calculateTotal() {
    this.totalSavings = this.accounts.reduce((sum, acc) => {
      return sum + this.convertAmount(acc);
    }, 0);
  }

  addAccount() {
    if (!this.newAccount.name) return;
    
    //  Crear copia y convertir a USD si es BRL
    const savingToSend: SavingAccount = {
      name: this.newAccount.name,
      balance: this.newAccount.balance || 0,
      color: this.newAccount.color,
      icon: this.newAccount.icon,
      currency: 'USD' // Backend siempre guarda en USD
    };

    //  Convertir a USD si el usuario está en BRL
    if (this.currencyCode === 'BRL') {
      savingToSend.balance = this.newAccount.balance / this.exchangeRate;
      console.log(`🔄 Convertido: R$ ${this.newAccount.balance} → $ ${savingToSend.balance.toFixed(2)}`);
    }

    console.group('📤 ENVIANDO AL BACKEND (Savings)');
    console.log('Monto original:', this.newAccount.balance, this.currencyCode);
    console.log('Monto convertido:', savingToSend.balance, 'USD');
    console.log('Objeto completo:', JSON.stringify(savingToSend, null, 2));
    console.groupEnd();

    // Enviar a la BD
    this.savingsService.createSaving(savingToSend).subscribe({
      next: (savedAccount) => {
        console.log('✓ Saving created:', savedAccount);
        
        this.accounts.push({ ...savedAccount, isEditing: false });
        this.calculateTotal();
        
        // Reset form
        this.newAccount = { 
          name: '', 
          balance: 0, 
          color: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)', 
          icon: 'bi-bank' 
        };
      },
      error: (err) => {
        console.error('Error creando cuenta', err);
        if (err.error && err.error.errors) {
          console.log('Detalles del error:', err.error.errors); 
        }
      }
    });
  }

  deleteAccount(index: number) {
    const account = this.accounts[index];
    if (!account.id) return;

    const confirmMsg = this.translateService.instant('SAVINGS.CONFIRM_DELETE') || '¿Estás seguro?';
    if (confirm(confirmMsg)) {
      this.savingsService.deleteSaving(account.id).subscribe({
        next: () => {
          this.accounts.splice(index, 1);
          this.calculateTotal();
        },
        error: (err) => console.error('Error borrando', err)
      });
    }
  }

  // Actualizar con conversión correcta
  updateSavingInDb(account: SavingAccount) {
    if (!account.id) return;

    // Crear copia para enviar
    const savingToUpdate = { ...account };

    // Si el balance se modificó y estamos en BRL, convertir a USD
    if (this.currencyCode === 'BRL') {
      // El balance en pantalla está en BRL, convertir a USD para guardar
      savingToUpdate.balance = account.balance / this.exchangeRate;
      savingToUpdate.currency = 'USD';
      console.log(`🔄 Actualizando: R$ ${account.balance} → $ ${savingToUpdate.balance.toFixed(2)}`);
    } else {
      savingToUpdate.currency = 'USD';
    }

    this.savingsService.updateSaving(account.id, savingToUpdate).subscribe({
      next: () => {
        this.calculateTotal();
        account.isEditing = false;
      },
      error: (err) => console.error('Error actualizando', err)
    });
  }

  // updateBalance ahora convierte correctamente
  updateBalance(account: SavingAccount, amount: number) {
    // El amount viene en la moneda actual del usuario
    account.balance += amount;
    if (account.balance < 0) account.balance = 0;
    
    // Guardamos
    this.updateSavingInDb(account);
  }

  enableEdit(account: SavingAccount) {
    account.isEditing = true;
  }

  saveEdit(account: SavingAccount) {
    this.updateSavingInDb(account);
  }
}