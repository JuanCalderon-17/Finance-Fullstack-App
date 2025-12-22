import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  
  {
    path: 'auth', // rutas de autenticacion Públicas
    children: [
      {
        path: 'login', // ...y siga con 'login' (/auth/login)
        loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register', // ...y siga con 'register' (/auth/register)
        loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
      }
    ]
  },
  {
    path: 'dashboard', 
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard] // AQUÍ PONEMOS AL GUARDIA!
  },

  {
    path: '',
    redirectTo: 'auth/login', // si entran a la raiz del app, esto redirije al login
    pathMatch: 'full'
  },
  
  // Si escriben cualquier ruta rara, los mando al login
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
