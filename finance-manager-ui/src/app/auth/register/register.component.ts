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

        if (typeof err.error === 'string') { // Caso A: El backend envía un mensaje simple (Ej: "El email ya está en uso")
          this.errorMessage = err.error;
        } else if (Array.isArray(err.error)) { // Caso B: El backend envía una lista de errores (Ej: Password débil)
          this.errorMessage = err.error.map((e: any) => e.description).join(' ');
        } else {
          this.errorMessage = "Ocurrió un error inesperado. Intenta de nuevo.";// Caso C: Error genérico (Servidor apagado, etc.)
        } 
        
        // 5. Apagamos la carga
        this.isLoading = false;
      }
    });
  }
} 