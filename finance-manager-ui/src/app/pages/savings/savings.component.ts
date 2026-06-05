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

  /** Convert an amount entered in the current display currency back to USD (how the backend stores it). */
  private toUsd(amount: number): number {
    return (this.currencyCode !== 'USD' && this.exchangeRate > 0)
      ? amount / this.exchangeRate
      : amount;
  }
  
  calculateTotal() {
    this.totalSavings = this.accounts.reduce((sum, acc) => {
      return sum + this.convertAmount(acc);
    }, 0);
  }

  addAccount() {
    if (!this.newAccount.name) return;
    
    // Backend always stores in USD: convert the entered amount from the display currency.
    const savingToSend: SavingAccount = {
      name: this.newAccount.name,
      balance: this.toUsd(this.newAccount.balance || 0),
      color: this.newAccount.color,
      icon: this.newAccount.icon,
      currency: 'USD'
    };

    this.savingsService.createSaving(savingToSend).subscribe({
      next: (savedAccount) => {
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

    // account.balance is always in USD in the frontend state (loaded from DB as USD).
    // Strip view-only fields so we don't send them to the backend.
    const { isEditing, editBalance, ...rest } = account;
    const savingToUpdate = { ...rest, currency: 'USD' };

    this.savingsService.updateSaving(account.id, savingToUpdate).subscribe({
      next: () => {
        this.calculateTotal();
        account.isEditing = false;
      },
      error: (err) => console.error('Error actualizando', err)
    });
  }

  updateBalance(account: SavingAccount, amount: number) {
    if (!account.id) return;

    // amount comes from quick buttons in the display currency; convert to USD before adding
    const amountInUsd = this.toUsd(amount);
    const previousBalance = account.balance;

    let newBalance = account.balance + amountInUsd;
    if (newBalance < 0) newBalance = 0;
    account.balance = newBalance;
    this.calculateTotal();

    const { isEditing, editBalance, ...rest } = account;
    this.savingsService.updateSaving(account.id, { ...rest, currency: 'USD' }).subscribe({
      error: (err) => {
        // Roll back the optimistic update if the request failed.
        account.balance = previousBalance;
        this.calculateTotal();
        console.error('Error actualizando', err);
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  enableEdit(account: SavingAccount) {
    // Edit form works in the display currency; balance is stored in USD.
    account.editBalance = this.convertAmount(account);
    account.isEditing = true;
  }

  saveEdit(account: SavingAccount) {
    // Convert the edited display-currency value back to USD before persisting.
    account.balance = this.toUsd(account.editBalance ?? 0);
    if (account.balance < 0) account.balance = 0;
    this.updateSavingInDb(account);
  }
}