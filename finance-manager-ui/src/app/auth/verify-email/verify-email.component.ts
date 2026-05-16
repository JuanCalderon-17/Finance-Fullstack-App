import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify-email.component.html',
  styleUrl: './verify-email.component.scss'
})
export class VerifyEmailComponent implements OnInit {
  isLoading = true;
  message: string = '';
  errorMessage: string = '';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const token = params['token'];
      const email = params['email'];

      if (!token || !email) {
        this.isLoading = false;
        this.errorMessage = 'Enlace inválido. Falta el token o el email.';
        return;
      }

      this.authService.verifyEmail(token, email).subscribe({
        next: (res: any) => {
          this.isLoading = false;
          this.message = res.message;
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.error || 'No se pudo verificar el correo. El enlace puede ser inválido o ya fue usado.';
        }
      });
    });
  }
}
