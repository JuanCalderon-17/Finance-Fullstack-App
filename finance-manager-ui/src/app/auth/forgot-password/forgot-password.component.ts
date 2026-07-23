import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule } from '@angular/forms';   // para [(ngModel)]
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AuthMessagesService } from '../../core/services/auth-messages.service';
import { TranslateModule } from '@ngx-translate/core';


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

  constructor(
    private authService: AuthService,
    private authMessages: AuthMessagesService
  ) {}

  onSubmit() {
    if (!this.email) return;

    this.isLoading = true;
    this.message = '';
    this.errorMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
    next: (res: any) => {
      this.isLoading = false;
      this.authMessages.fromResponse(res, 'AUTH.FORGOT_PASSWORD.SUCCESS_MSG')
        .subscribe(msg => this.message = msg);
      this.email = '';
    },
    error: (error) => {
      this.isLoading = false;
      this.authMessages.fromError(error, 'AUTH.FORGOT_PASSWORD.ERROR_GENERIC')
        .subscribe(msg => this.errorMessage = msg);
    }
    });
  }
}