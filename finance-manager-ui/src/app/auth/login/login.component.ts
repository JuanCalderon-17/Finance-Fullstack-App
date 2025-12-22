import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; // <-- 1. IMPORTAR FormsModule
import { AuthService } from '../../core/services/auth.service'; // <-- 1. IMPORTA EL SERVICIO
import { Router } from '@angular/router'; //Importo router para mover al usuario de paginas
import { RouterModule } from '@angular/router'; // Añade RouterModule

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  model: any = {}; 
  errorMessage: string | null = null;
  isLoading: boolean = false;

  // Inyectando el contructor
  constructor(
    private authService: AuthService,
    private router: Router 
  ) { }

  login() { 
    this.isLoading = true;

    console.log('Enviando al backend:', this.model);
    this.errorMessage = null; //reset previous error

    this.authService.login(this.model).subscribe({
      next: (response: any) => {// 'next' se ejecuta si la llamada es exitosa
      console.log('Respuesta exitosa', response);
      if (response && response.token) {
        localStorage.setItem('user', JSON.stringify(response));
        console.log('Token guardado en localStorage');
        this.router.navigate(['/dashboard']);
        }
      },

      // 'error' se ejecuta si la API devuelve un error
      error : (err) => {
        console.error('Hubo un error en el login', err)

        //friendly error message
        if(err.status === 401 ||  err.status === 400) {
          this.errorMessage = 'Usuario o contraseña incorrectos';  
        } else {
          this.errorMessage = 'Ocurrió un error. Inténtalo más tarde.';
        }

        this.isLoading = false;
      }
    })
  }
}
