import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { UserFormModalComponent } from '../../components/user-form-modal/user-form-modal.component';
import { AdminUsuariosService } from '../../services/admin-usuarios.service';
import { User } from '../../interfaces/user.interface';

@Component({
  selector: 'app-administrar-usuarios',
  standalone: true,
  imports: [CommonModule, UserFormModalComponent],
  templateUrl: './administrar-usuarios.component.html',
  styleUrls: ['./administrar-usuarios.component.scss']
})
export class AdministrarUsuariosComponent implements OnInit {
  authService = inject(AuthService);
  adminUsuariosService = inject(AdminUsuariosService);
  
  // Estado del modal
  isModalOpen = signal(false);
  selectedUser = signal<User | null>(null); // Usuario seleccionado para editar

  // Datos de usuarios
  users = signal<User[]>([]);

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.adminUsuariosService.getUsuarios().subscribe({
      next: (data) => {
        this.users.set(data);
      },
      error: (err) => console.error('Error cargando usuarios', err)
    });
  }

  // Helpers para permisos en la vista
  canCreateUser(): boolean {
    const role = this.authService.userRole();
    return role === 'GOD';
  }

  canEditUser(targetUser: User): boolean {
    const myRole = this.authService.userRole();
    return myRole === 'GOD';
  }

  // Acciones
  onLogout(): void {
    this.authService.logout();
  }

  onCreateUser(): void {
    this.selectedUser.set(null); // Reset para crear
    this.isModalOpen.set(true);
  }

  onModalClose(): void {
    this.isModalOpen.set(false);
    this.selectedUser.set(null);
  }

  onUserSaved(userPayload: any): void {
    const editingUser = this.selectedUser();
    
    if (editingUser) {
      // MODO EDICIÓN
      this.adminUsuariosService.updateUsuario(editingUser.id, userPayload).subscribe({
        next: (updatedUser) => {
          this.users.update(current => 
            current.map(u => u.id === updatedUser.id ? updatedUser : u)
          );
          this.onModalClose();
        },
        error: (err) => console.error('Error actualizando usuario', err)
      });
    } else {
      // MODO CREACIÓN
      this.adminUsuariosService.createUsuario(userPayload).subscribe({
        next: (newUser) => {
          this.users.update(current => [newUser, ...current]);
          this.onModalClose();
        },
        error: (err) => console.error('Error creando usuario', err)
      });
    }
  }

  onEditUser(user: User): void {
    this.selectedUser.set(user);
    this.isModalOpen.set(true);
  }

  onDeleteUser(user: User): void {
    if (!confirm(`¿Estás seguro de que deseas eliminar permanentemente al usuario "${user.username}"? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.adminUsuariosService.deleteUsuario(user.id).subscribe({
      next: () => {
        this.users.update(current => current.filter(u => u.id !== user.id));
        // Opcional: Mostrar toast de éxito
      },
      error: (err) => {
        console.error('Error eliminando usuario', err);
        alert('Error al eliminar usuario: ' + (err.error?.message || 'Error desconocido'));
      }
    });
  }

  onToggleStatus(user: User): void {
    if (!this.canEditUser(user)) return;
    if (this.isToggling(user.id)) return; // Prevención doble click

    const newStatus = !user.activo;
    
    // Estado de carga local
    this.togglingIds.update(ids => [...ids, user.id]);

    // Optimistic update
    this.users.update(users => 
      users.map(u => u.id === user.id ? { ...u, activo: newStatus } : u)
    );

    this.adminUsuariosService.toggleEstado(user.id, newStatus).subscribe({
      next: () => {
        this.togglingIds.update(ids => ids.filter(id => id !== user.id));
      },
      error: (err) => {
        console.error('Error cambiando estado', err);
        // Revertir
        this.users.update(users => 
          users.map(u => u.id === user.id ? { ...u, activo: !newStatus } : u)
        );
        this.togglingIds.update(ids => ids.filter(id => id !== user.id));
      }
    });
  }

  // Estado de carga para toggles
  togglingIds = signal<number[]>([]);
  
  isToggling(userId: number): boolean {
    return this.togglingIds().includes(userId);
  }
}
