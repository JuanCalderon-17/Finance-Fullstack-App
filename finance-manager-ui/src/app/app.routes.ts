import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { LandingComponent } from './pages/landing/landing.component';
import { ResetPasswordComponent } from './auth/reset-password/reset-password.component';
import { ShellComponent } from './layout/shell/shell.component';

export const routes: Routes = [

  // Public
  {
    path: '',
    component: LandingComponent,
    pathMatch: 'full'
  },

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
      },
      {
        path: 'forgot-password',
        loadComponent: () => import('./auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
      },
      {
        path: 'reset-password',
        loadComponent: () => import('./auth/reset-password/reset-password.component').then(m => ResetPasswordComponent)
      }
    ]
  },

  // Protected — shell wrapper
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent)
      },
      {
        path: 'debts',
        loadComponent: () => import('./pages/debts/debts.component').then(m => m.DebtsComponent)
      },
      {
        path: 'savings',
        loadComponent: () => import('./pages/savings/savings.component').then(m => m.SavingsComponent)
      }
    ]
  },

  {
    path: '**',
    redirectTo: 'auth/login'
  }
];
