import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule, Router } from '@angular/router';
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import { AuthService } from "../../core/services/auth.service";
import { AuthMessagesService } from "../../core/services/auth-messages.service";

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  
  model: any = { fullName: '', email: '', password: '', confirmPassword: '', acceptedTerms: false };
  isLoading: boolean = false;

  // Independent show/hide for each field, so the eye on one doesn't reveal the other.
  showPassword: boolean = false;
  showConfirmPassword: boolean = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  constructor(
    private authService: AuthService, 
    private router: Router,
    private translate: TranslateService,
    private authMessages: AuthMessagesService
  ) { }
  
  register() {
    // 1. Limpiamos errores anteriores
    this.errorMessage = null;

    // 2. Validamos manual. Si algo falla, la función 'validateForm' pone el mensaje en 'errorMessage'
    // y devuelve FALSE. Entonces hacemos return para no seguir.
    if (!this.validateForm()) {
        return; 
    }

    // 3. Si todo está bien, activamos carga y enviamos
    this.isLoading = true;

    this.authService.register(this.model).subscribe({
      next: (res: any) => {
        this.isLoading = false;
        this.errorMessage = null;
        // Backend no longer returns a token — user must verify email first.
        // The response code tells us whether the email actually went out.
        this.authMessages.fromResponse(res, 'AUTH.STATUS.VERIFICATION_SENT')
          .subscribe(msg => this.successMessage = msg);
      },
      error: (err) => {
        this.handleError(err);
        this.isLoading = false;
      }
    });
  }

  // Esta función verifica todo y configura el mensaje de error si encuentra algo mal
  validateForm(): boolean {
    
    // A. Campos Vacíos
    if (!this.model.fullName?.trim()) {
      this.errorMessage = this.translate.instant('AUTH.REGISTER.ERRORS.EMPTY_NAME');
      return false;
    }

    if (!this.model.email?.trim()) {
      this.errorMessage = this.translate.instant('AUTH.REGISTER.ERRORS.EMPTY_EMAIL');
      return false;
    }

    if (!this.model.password?.trim()) {
      this.errorMessage = this.translate.instant('AUTH.REGISTER.ERRORS.EMPTY_PASSWORD');
      return false;
    }

    // B. Complejidad Contraseña (Mayúscula y Número)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d).{6,}$/;
    if (!passwordRegex.test(this.model.password)) {
      this.errorMessage = this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_COMPLEXITY');
      return false;
    }

    // C. Coincidencia de Contraseñas
    if (this.model.password !== this.model.confirmPassword) {
      this.errorMessage = this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_MISMATCH');
      return false;
    }

    // D. Aceptación de Términos y Política de Privacidad
    if (!this.model.acceptedTerms) {
      this.errorMessage = this.translate.instant('AUTH.REGISTER.ERRORS.TERMS_NOT_ACCEPTED');
      return false;
    }

    return true; // Todo correcto
  }

  handleError(err: any) {
    // ASP.NET Identity validation failures arrive as a bare array of {code, description}
    if (Array.isArray(err.error)) {
      this.errorMessage = err.error.map((e: any) => {
        if (e.code === 'InvalidUserName') return this.translate.instant('AUTH.REGISTER.ERRORS.INVALID_USER');
        if (e.code === 'PasswordTooShort') return this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_SHORT');
        if (e.code === 'PasswordRequiresUpper') return this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_UPPER');
        if (e.code === 'PasswordRequiresDigit') return this.translate.instant('AUTH.REGISTER.ERRORS.PASSWORD_DIGIT');
        return e.description;
      }).join(' ');
      return;
    }
    // Everything else carries our own code; never render the backend's Spanish prose
    this.authMessages.fromError(err, 'AUTH.REGISTER.ERRORS.GENERIC')
      .subscribe(msg => this.errorMessage = msg);
  }
}