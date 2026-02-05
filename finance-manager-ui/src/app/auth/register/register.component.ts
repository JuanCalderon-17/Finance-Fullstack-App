import { Component } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { RouterModule, Router } from '@angular/router';
import { TranslateModule } from "@ngx-translate/core";

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslateModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent {
  
  model: any = {};
  isLoading: boolean = false;
  errorMessage: string | null = null;

  constructor(private authService: AuthService, private router: Router) { }
  
  register() {
    console.log('Enviando datos del registro:', this.model);  
    this.isLoading = true;
    this.errorMessage = null;

    this.authService.register(this.model).subscribe({
      next: (response) => {
        console.log('Usuario registrado exitosamente', response);
        
        // 🛑 PASO 1: Guardar manualmente el usuario/token que nos dio el registro
        // Esto es crucial para que el AuthGuard encuentre la llave.
        localStorage.setItem('user', JSON.stringify(response));

        // 🛑 PASO 2: Forzar la recarga de la página hacia el dashboard
        // Usamos window.location.href en lugar de router.navigate para reiniciar la memoria del AuthGuard
        window.location.href = '/dashboard';
      },
      error: (err) => {
        console.error("Error : ", err);

        if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else if (Array.isArray(err.error)) { 
          this.errorMessage = err.error.map((e: any) => {
            if (e.code === 'InvalidUserName') return "⛔ El nombre de usuario NO puede tener espacios ni símbolos.";
            if (e.code === 'PasswordTooShort') return "⛔ La contraseña es muy corta.";
            return e.description; 
          }).join(' ');
        } else {
          this.errorMessage = "Ocurrió un error inesperado. Intenta de nuevo.";
        }

        this.isLoading = false;
      }
    });
  }

  // ¡AQUÍ YA NO HAY NINGUNA FUNCIÓN loginAfterRegister! 🗑️
  // Si tenías código aquí abajo, asegúrate de que esté borrado.
}