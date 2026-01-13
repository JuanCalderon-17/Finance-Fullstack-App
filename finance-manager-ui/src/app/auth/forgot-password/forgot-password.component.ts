import { Component } from '@angular/core';
import { CommonModule } from '@angular/common'; // <--- NECESARIO para *ngIf
import { FormsModule } from '@angular/forms';   // <--- NECESARIO para [(ngModel)]
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink], // <--- Agregamos los módulos aquí
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {
  email: string = '';
  isLoading: boolean = false;
  message: string = '';      // Para mensaje verde (éxito)
  errorMessage: string = ''; // Para mensaje rojo (error)

  constructor(private authService: AuthService) {}

  onSubmit() {
    if (!this.email) return;

    this.isLoading = true;
    this.message = '';
    this.errorMessage = '';

    this.authService.forgotPassword(this.email).subscribe({
      next: () => {
        this.isLoading = false;
        this.message = '¡Enlace enviado! Revisa tu correo electrónico.';
        this.email = ''; // Limpiamos el campo
      },
      error: (error) => {
        this.isLoading = false;
        // Si el backend manda un mensaje de error específico, lo mostramos, si no, uno genérico
        this.errorMessage = error.error || 'No se pudo enviar el correo. Intenta nuevamente.';
        console.error(error);
      }
    });
  }
}