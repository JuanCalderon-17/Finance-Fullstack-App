import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { DebtsComponent } from './pages/debts/debts.component';
import { LandingComponent } from './pages/landing/landing.component';

export const routes: Routes = [
  
  // 1. LA ENTRADA PRINCIPAL (Esto es lo que verá tu familia)
  {
    path: '', 
    component: LandingComponent,
    pathMatch: 'full' // Agregamos esto por buena práctica
  },
  
  // 2. RUTAS PÚBLICAS (Login y Registro)
  {
    path: 'auth', 
    children: [
      {
        path: 'login', 
        loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent)
      },
      {
        path: 'register', 
        loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent)
      }
    ]
  },

  // 3. RUTAS PRIVADAS (Protegidas por el Guardia)
  {
    path: 'dashboard', 
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard] 
  },

  {
    path: 'debts',
    loadComponent: () => import('./pages/debts/debts.component').then(m => m.DebtsComponent),
    canActivate: [authGuard]
  },

  {
    path: 'savings',
    loadComponent: () => import('./pages/savings/savings.component').then(m => m.SavingsComponent),
    canActivate: [authGuard]
  },
    
  // Si escriben cualquier ruta rara, los mando al login
  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
