import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

export const authGuard: CanActivateFn = (route, state) => {
  // 1. Inyectamos el Router (para poder navegar)
  const router = inject(Router);


  // 2. Buscamos el usuario en el localStorage
  const userJson = localStorage.getItem('user');

  if (userJson) {
    // Si existe el usuario
    return true;
  } else {
    // Si NO existe, lo mandamos al Login
    console.warn('¡Intento de acceso no autorizado! Redirigiendo al login...')
    router.navigate(['/auth/login']);  
    return false;
  }


};

