import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-access-denied',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './access-denied.html',
  styleUrls: ['./access-denied.scss']
})
export class AccessDeniedComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  onGoToLogin(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
