import { DOCUMENT } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './features/auth/services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <button
      type="button"
      class="theme-toggle-btn"
      [attr.aria-label]="isDarkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
      (click)="toggleTheme()">
      <i class="bi" [class.bi-sun-fill]="isDarkMode()" [class.bi-moon-stars-fill]="!isDarkMode()"></i>
    </button>
    <router-outlet></router-outlet>
  `,
  styles: [`
    .theme-toggle-btn {
      position: fixed;
      top: auto;
      right: 1.25rem;
      bottom: 1.25rem;
      width: 32px;
      height: 32px;
      font-size: 0.85rem;
      border-radius: 999px;
      border: 1px solid rgba(148, 163, 184, 0.4);
      background: rgba(2, 6, 23, 0.75);
      color: #f8fafc;
      backdrop-filter: blur(10px);
      z-index: 1200;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }

    @media (max-width: 768px) {
      .theme-toggle-btn {
        right: 1rem;
        bottom: 4.5rem;
      }
    }

    .theme-toggle-btn:hover {
      border-color: rgba(59, 130, 246, 0.7);
      transform: translateY(-1px);
    }

    :host-context([data-theme='light']) .theme-toggle-btn {
      background: rgba(255, 255, 255, 0.9);
      color: #0f172a;
      border-color: rgba(15, 23, 42, 0.2);
    }
  `]
})
export class AppComponent implements OnInit {
  private readonly storageKey = 'taskorbit.theme';
  private authService = inject(AuthService);
  private document = inject(DOCUMENT);
  isDarkMode = signal(true);

  ngOnInit() {
    this.initTheme();
    this.authService.restoreSession().subscribe();
  }

  toggleTheme(): void {
    const next = this.isDarkMode() ? 'light' : 'dark';
    this.applyTheme(next);
    localStorage.setItem(this.storageKey, next);
  }

  private initTheme(): void {
    const savedTheme = localStorage.getItem(this.storageKey);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      this.applyTheme(savedTheme);
      return;
    }
    this.applyTheme('dark');
  }

  private applyTheme(theme: 'light' | 'dark'): void {
    const isDark = theme === 'dark';
    this.isDarkMode.set(isDark);
    this.document.documentElement.setAttribute('data-theme', theme);
    this.document.documentElement.setAttribute('data-bs-theme', theme);
  }
}
