import { Component, EventEmitter, inject, Input, Output, signal, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AuthService } from '../../../../features/auth/services/auth.service';
import { UserRole } from '../../../../features/auth/interfaces/auth-user.interface';
import { User } from '../../interfaces/user.interface';

@Component({
  selector: 'app-user-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './user-form-modal.component.html',
  styleUrls: ['./user-form-modal.component.scss']
})
export class UserFormModalComponent implements OnInit, OnChanges {
  private fb = inject(FormBuilder);
  public authService = inject(AuthService); 

  @Input() isOpen = false;
  @Input() userToEdit: User | null = null; // Usuario a editar
  @Output() close = new EventEmitter<void>();
  @Output() userSaved = new EventEmitter<any>(); 

  userForm: FormGroup;
  availableRoles = signal<UserRole[]>([]);
  isLoading = signal(false);

  // Password UI state
  showPassword = signal(false);
  showConfirmPassword = signal(false);
  passwordStrength = signal<'weak' | 'medium' | 'strong' | null>(null);

  constructor() {
    this.userForm = this.fb.group({
      nombre_completo: ['', [Validators.required]],
      username: ['', [Validators.required, Validators.minLength(4)]],
      telefono: ['', [Validators.required, Validators.pattern(/^[0-9]{10}$/)]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmar_password: ['', [Validators.required]],
      rol: ['', [Validators.required]],
      activo: [true]
    }, { validators: this.passwordMatchValidator });

    // Monitor password changes for strength
    this.userForm.get('password')?.valueChanges.subscribe(value => {
      this.updatePasswordStrength(value);
    });
  }

  ngOnInit() {
    this.setupRoles();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.userToEdit) {
        // Modo Edición: Llenar formulario y quitar validación de password
        this.userForm.patchValue({
          nombre_completo: this.userToEdit.nombre_completo,
          username: this.userToEdit.username,
          telefono: this.userToEdit.telefono,
          rol: this.userToEdit.rol,
          activo: this.userToEdit.activo,
          password: '',
          confirmar_password: ''
        });
        
        // Quitar requerimiento de password en edición
        this.userForm.get('password')?.clearValidators();
        this.userForm.get('password')?.updateValueAndValidity();
        this.userForm.get('confirmar_password')?.clearValidators();
        this.userForm.get('confirmar_password')?.updateValueAndValidity();
      } else {
        // Modo Creación: Resetear y poner validación de password
        this.userForm.reset({ activo: true });
        this.userForm.get('password')?.setValidators([Validators.required, Validators.minLength(8)]);
        this.userForm.get('password')?.updateValueAndValidity();
        this.userForm.get('confirmar_password')?.setValidators([Validators.required]);
        this.userForm.get('confirmar_password')?.updateValueAndValidity();
      }
    }
  }

  get f() { return this.userForm.controls; }
  
  get isEditMode(): boolean {
    return !!this.userToEdit;
  }

  private setupRoles() {
    const currentUserRole = this.authService.userRole();
    
    if (currentUserRole === 'GOD') {
      this.availableRoles.set(['GOD', 'ADMIN', 'USER']);
    } else if (currentUserRole === 'ADMIN') {
      this.availableRoles.set(['ADMIN', 'USER']); 
    } else {
      this.availableRoles.set([]); 
    }
  }

  private passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
    const password = group.get('password')?.value;
    const confirmPassword = group.get('confirmar_password')?.value;

    // Si estamos en edición y el password está vacío, no validar match
    if (!password && !confirmPassword) return null;

    return password === confirmPassword ? null : { mismatch: true };
  }

  updatePasswordStrength(password: string): void {
    if (!password) {
      this.passwordStrength.set(null);
      return;
    }

    let score = 0;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 2) this.passwordStrength.set('weak');
    else if (score <= 4) this.passwordStrength.set('medium');
    else this.passwordStrength.set('strong');
  }

  generateSecurePassword(): void {
    const length = 12; // Minimum 10 required, using 12 for extra safety
    const upperCase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowerCase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*';
    
    // Mandatory characters
    let password = '';
    password += this.getRandomChars(upperCase, 2);
    password += this.getRandomChars(lowerCase, 2);
    password += this.getRandomChars(numbers, 2);
    password += this.getRandomChars(special, 2);

    // Fill remaining
    const allChars = upperCase + lowerCase + numbers + special;
    const remainingLength = length - password.length;
    password += this.getRandomChars(allChars, remainingLength);

    // Shuffle password
    password = password.split('').sort(() => 0.5 - Math.random()).join('');

    // Update form
    this.userForm.patchValue({
      password: password,
      confirmar_password: password
    });
    
    // Trigger validation and strength update
    this.userForm.get('password')?.markAsDirty();
    this.userForm.get('confirmar_password')?.markAsDirty();
    this.updatePasswordStrength(password);
  }

  private getRandomChars(source: string, count: number): string {
    let result = '';
    for (let i = 0; i < count; i++) {
      result += source.charAt(Math.floor(Math.random() * source.length));
    }
    return result;
  }

  copyToClipboard(text: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      // Opcional: Mostrar toast o tooltip
      console.log('Contraseña copiada');
    }).catch(err => {
      console.error('Error al copiar', err);
    });
  }

  togglePasswordVisibility(field: 'password' | 'confirm'): void {
    if (field === 'password') {
      this.showPassword.update(v => !v);
    } else {
      this.showConfirmPassword.update(v => !v);
    }
  }

  onClose() {
    this.userForm.reset({ activo: true });
    this.close.emit();
  }

  onSubmit() {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    
    const formValue = this.userForm.value;
    // Eliminar confirmar_password del payload final
    const { confirmar_password, ...payload } = formValue;
    
    // Si es edición y password está vacío, eliminarlo del payload
    if (this.isEditMode && !payload.password) {
      delete payload.password;
    }
    
    this.userSaved.emit(payload);
    
    this.isLoading.set(false);
    this.onClose();
  }
}
