import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
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
export class SavingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currencySymbol: string = '$';
  currencyCode: string = 'USD'; 
  exchangeRate: number = 1;
  accounts: SavingAccount[] = [];
  
  newAccount: SavingAccount = {
    name: '',
    balance: 0,
    color: 'GREEN',
    icon: 'bi-bank'
  };

  totalSavings: number = 0;

  colors: string[] = ['GREEN', 'PURPLE', 'RED', 'BLACK'];

  constructor(
    private savingsService: SavingsService, 
    private currencyStateService: CurrencyStateService, 
    private translateService: TranslateService,
    private tutorialService: TutorialService
  ) {}

  ngOnInit(): void {
    this.currencyStateService.currency$.pipe(takeUntil(this.destroy$)).subscribe(currency => {
      this.currencyCode = currency.code;
      this.currencySymbol = currency.symbol;
      this.exchangeRate = currency.rate;
      this.calculateTotal();
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

  convertAmount(acc: SavingAccount): number {
    return this.currencyStateService.convert(acc.balance, acc.currency || 'USD');
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
          color: 'GREEN', 
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

  updateSavingInDb(account: SavingAccount) {
    if (!account.id) return;

    // account.balance is always in USD in the frontend state (loaded from DB as USD)
    const savingToUpdate = { ...account, currency: 'USD' };

    this.savingsService.updateSaving(account.id, savingToUpdate).subscribe({
      next: () => {
        this.calculateTotal();
        account.isEditing = false;
      },
      error: (err) => console.error('Error actualizando', err)
    });
  }

  updateBalance(account: SavingAccount, amount: number) {
    // amount comes from quick buttons in the display currency; convert to USD before adding
    const amountInUsd = (this.currencyCode !== 'USD' && this.exchangeRate > 0)
      ? amount / this.exchangeRate
      : amount;
    account.balance += amountInUsd;
    if (account.balance < 0) account.balance = 0;
    this.updateSavingInDb(account);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enableEdit(account: SavingAccount) {
    account.isEditing = true;
  }

  saveEdit(account: SavingAccount) {
    this.updateSavingInDb(account);
  }
}