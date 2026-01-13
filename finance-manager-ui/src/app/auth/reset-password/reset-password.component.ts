import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service'; 

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss'
})
export class ResetPasswordComponent implements OnInit {
  token: string = '';
  email: string = '';
  newPassword: string = '';
  confirmPassword: string = '';
  isLoading: boolean = false;
  message: string = '';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authService: AuthService
  ) {}

  ngOnInit() {
    // Obtener token y email de la URL
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';
      
      if (!this.token || !this.email) {
        this.errorMessage = 'Link inválido o expirado.';
      }
    });
  }

  onSubmit() {
    // Validaciones
    if (!this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden.';
      return;
    }

    if (this.newPassword.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.isLoading = true;
    this.message = '';
    this.errorMessage = '';

    // Llamar al servicio
    this.authService.resetPassword(this.email, this.token, this.newPassword).subscribe({
      next: () => {
        this.isLoading = false;
        this.message = '¡Contraseña restablecida correctamente!';
        
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 2000);
      },
      error: (error) => {
        this.isLoading = false;
        this.errorMessage = error.error?.error || 'No se pudo restablecer la contraseña. El token puede haber expirado.';
        console.error(error);
      }
    });
  }
}