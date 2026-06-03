import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { TransactionService } from '../../core/services/transaction.service';
import { Transaction } from '../../shared/models/transaction.model';

type CategoryType = 'income' | 'savings' | 'expense';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss']
})
export class SettingsComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  // Same buckets the dashboard uses for type derivation.
  private incomeCategories = ['Sueldo', 'Negocio', 'Venta', 'Ingreso Extra', 'SALARY', 'BUSINESS', 'SALE', 'EXTRA_INCOME'];
  private savingsCategories = ['Ahorro', 'Savings', 'Poupança', 'SAVING'];

  // Export
  fromDate: string = '';
  toDate: string = '';
  isExporting = false;
  statusKey: string | null = null;
  statusKind: 'success' | 'info' | 'error' | null = null;
  statusCount = 0;

  constructor(private transactionService: TransactionService) {}

  ngOnInit(): void {
    this.applyPreset('thisMonth');
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  applyPreset(preset: 'thisMonth' | 'last30' | 'allTime'): void {
    const today = new Date();
    if (preset === 'thisMonth') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      this.fromDate = this.toIsoDate(first);
      this.toDate = this.toIsoDate(today);
    } else if (preset === 'last30') {
      const past = new Date(today);
      past.setDate(today.getDate() - 30);
      this.fromDate = this.toIsoDate(past);
      this.toDate = this.toIsoDate(today);
    } else {
      this.fromDate = '';
      this.toDate = '';
    }
    this.statusKey = null;
  }

  exportCsv(): void {
    this.statusKey = null;

    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.statusKind = 'error';
      this.statusKey = 'SETTINGS.EXPORT.ERROR_RANGE_INVALID';
      return;
    }

    this.isExporting = true;
    this.transactionService.getTransactions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (all) => {
          const filtered = this.filterByRange(all);
          if (filtered.length === 0) {
            this.statusKind = 'info';
            this.statusKey = 'SETTINGS.EXPORT.NO_DATA';
            this.isExporting = false;
            return;
          }
          const csv = this.buildCsv(filtered);
          const filename = this.buildFilename();
          this.downloadCsv(csv, filename);
          this.statusKind = 'success';
          this.statusKey = 'SETTINGS.EXPORT.SUCCESS';
          this.statusCount = filtered.length;
          this.isExporting = false;
        },
        error: () => {
          this.statusKind = 'error';
          this.statusKey = 'SETTINGS.EXPORT.ERROR_GENERIC';
          this.isExporting = false;
        }
      });
  }

  private filterByRange(all: Transaction[]): Transaction[] {
    return all.filter(t => {
      const d = this.toIsoDate(new Date(t.transactionDate));
      if (this.fromDate && d < this.fromDate) return false;
      if (this.toDate && d > this.toDate) return false;
      return true;
    }).sort((a, b) => {
      const da = new Date(a.transactionDate).getTime();
      const db = new Date(b.transactionDate).getTime();
      return da - db;
    });
  }

  private buildCsv(transactions: Transaction[]): string {
    const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Currency'];
    const rows = transactions.map(t => [
      this.toIsoDate(new Date(t.transactionDate)),
      this.getCategoryType(t.category),
      t.category ?? '',
      t.description ?? '',
      (t.amount ?? 0).toString(),
      t.currency ?? ''
    ].map(this.csvEscape).join(','));
    return [headers.join(','), ...rows].join('\r\n');
  }

  private csvEscape(value: string): string {
    const s = String(value ?? '');
    if (/[",\r\n]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  private getCategoryType(category: string): CategoryType {
    if (this.incomeCategories.includes(category)) return 'income';
    if (this.savingsCategories.includes(category)) return 'savings';
    return 'expense';
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildFilename(): string {
    const from = this.fromDate || 'all';
    const to = this.toDate || 'all';
    return `finanzas-transactions-${from}_${to}.csv`;
  }

  private downloadCsv(csv: string, filename: string): void {
    // BOM so Excel opens UTF-8 correctly.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
