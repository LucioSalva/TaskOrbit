import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { SessionService } from '../../../../core/services/session.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private sessionService = inject(SessionService);
  private router = inject(Router);

  // Signals para el estado de la UI
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  // Formulario reactivo
  loginForm: FormGroup = this.fb.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  constructor() {}

  ngOnInit(): void {
    // Si ya hay sesión, redirigir
    if (this.sessionService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
    }
  }

  // Getters para facilitar el acceso en el template
  get f() { return this.loginForm.controls; }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.loginForm.value;

    this.authService.login({ username, password }).subscribe({
      next: (response) => {
        // Redirigir al dashboard administrativo
        // El estado de sesión ya se actualizó en el servicio
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        console.error('Login error:', err);
        
        // Manejo de errores basado en la respuesta uniforme del backend
        if (err.error && err.error.message) {
           this.errorMessage.set(err.error.message);
        } else if (err.status === 401 || err.status === 403) {
           this.errorMessage.set('Usuario o contraseña incorrectos.');
        } else if (err.status === 0) {
           this.errorMessage.set('No hay conexión con el servidor.');
        } else {
           this.errorMessage.set('Ocurrió un error inesperado. Intente más tarde.');
        }
      },
      complete: () => {
        this.isLoading.set(false);
      }
    });
  }
}
