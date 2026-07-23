import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { AuthMessagesService } from '../../core/services/auth-messages.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  token: string = '';
  email: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  showNewPassword: boolean = false;
  showConfirmPassword: boolean = false;
  isLoading: boolean = false;
  message: string = '';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService,
    private translate: TranslateService,
    private authMessages: AuthMessagesService
  ) {}

  ngOnInit() {
    // Obtener token y email de la URL
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';

      if (!this.token || !this.email) {
        // .get(), not .instant(): this page loads cold from an email link, so
        // the locale file may still be in flight.
        this.translate.get('AUTH.RESET_PASSWORD.INVALID_LINK')
          .subscribe(msg => this.errorMessage = msg);
      }
    });
  }

  onSubmit() {
    // Validaciones
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = this.translate.instant('AUTH.RESET_PASSWORD.ERRORS.EMPTY_FIELDS');
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = this.translate.instant('AUTH.RESET_PASSWORD.ERRORS.PASSWORD_MISMATCH');
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = this.translate.instant('AUTH.RESET_PASSWORD.ERRORS.PASSWORD_SHORT');
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.errorMessage = '';

    // Llamar al servicio
    this.authService.resetPassword(this.email, this.token, this.newPassword).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.authMessages.fromResponse(res, 'AUTH.STATUS.PASSWORD_RESET')
          .subscribe(msg => this.message = msg);

        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (error) => {
        this.isLoading = false;
        this.authMessages.fromError(error, 'AUTH.STATUS.RESET_FAILED')
          .subscribe(msg => this.errorMessage = msg);
        console.error(error);
      }
    });
  }
}
