import { Component  } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { AuthService } from "../../core/services/auth.service";
import { RouterModule, Router } from '@angular/router'; // Añade RouterModule

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})

export class RegisterComponent {
  model: any = {} 
  //Variables de Estado
  isLoading: boolean = false;
  errorMessage:  string | null = null;


  constructor(private authService: AuthService, private router: Router) { }
  
  //funcion para llamar servicio
  register() {
    console.log('Enviando datos del registro:', this.model);  
    this.isLoading = true;
    this.errorMessage = null;

    this.authService.register(this.model).subscribe({
      // 'next' se ejecuta si el registro es exitoso
      next: (response) => {
        console.log('Usuario registrado exitosamente', response)
        this.router.navigate(['/auth/login']);
      },
      error: (err) => {
        console.error("Error : ", err);

        if (typeof err.error === 'string') {
          this.errorMessage = err.error;
        } else if (Array.isArray(err.error)) { 
          
          this.errorMessage = err.error.map((e: any) => {
            // El código 'InvalidUserName' es el que usa .NET cuando hay caracteres raros o ESPACIOS
            if (e.code === 'InvalidUserName') {
              return "⛔ El nombre de usuario NO puede tener espacios ni símbolos (solo letras y números).";
            }
            // Si el error es otro (ej: PasswordTooShort), dejamos el mensaje original o lo traducimos también
            if (e.code === 'PasswordTooShort') {
              return "⛔ La contraseña es muy corta.";
            }
            
            return e.description; // Para cualquier otro error, mostramos el que viene del servidor
          }).join(' ');
          // ----------------------------------------------------

        } else {
          this.errorMessage = "Ocurrió un error inesperado en el servidor. Intenta de nuevo.";
        }

        // 5. Apagamos la carga
        this.isLoading = false;
      }
    });
  }
} 