import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   // para [(ngModel)]
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';


@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule], 
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  email: string = '';
  isLoading: boolean = false;
  message: string = '';      
  errorMessage: string = ''; 

  constructor(private authService: AuthService, private translateService: TranslateService) {}

  onSubmit() {
    if (!this.email) return;

    this.isLoading = true;
    this.message = '';
    this.errorMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
    next: () => {
      this.isLoading = false;
      this.message = this.translateService.instant('AUTH.FORGOT_PASSWORD.SUCCESS_MSG');
      this.email = '';
    },
    error: (error) => {
      this.isLoading = false;
      this.errorMessage = error.error || this.translateService.instant('AUTH.FORGOT_PASSWORD.ERROR_GENERIC');
    }
    });
  }
}