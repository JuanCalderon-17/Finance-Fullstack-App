import { CanActivateFn } from '@angular/router';
import { inject } from '@angular/core';
import { Router } from '@angular/router';

// Lee el 'exp' (segundos unix) del payload del JWT sin verificar la firma —
// solo para saber si ya venció y evitar entrar con una sesión muerta.
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true; // token ilegible = inválido
  }
}

export const authGuard: CanActivateFn = (route, state) => {
  // 1. Inyectamos el Router (para poder navegar)
  const router = inject(Router);

  // 2. Buscamos el usuario en el localStorage
  const userJson = localStorage.getItem('user');

  if (userJson) {
    try {
      const user = JSON.parse(userJson);
      if (user.token && !isTokenExpired(user.token)) {
        return true;
      }
    } catch { /* JSON corrupto: tratar como no autenticado */ }

    // Sesión vencida o corrupta: limpiar para no entrar a un dashboard de 401s
    localStorage.removeItem('user');
  }

  console.warn('Sesión ausente o expirada. Redirigiendo al login...');
  router.navigate(['/auth/login']);
  return false;
};
