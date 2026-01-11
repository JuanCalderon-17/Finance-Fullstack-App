import { Component } from '@angular/core';
import { RouterLink } from '@angular/router'; 

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [RouterLink], //inprto para el component
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss'
})
export class ForgotPasswordComponent {}