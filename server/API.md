# Documentación de API - Gestión de Usuarios

Este documento detalla los endpoints de administración de usuarios y sus requisitos de seguridad.

## Seguridad y Autenticación

Todos los endpoints bajo `/api/usuarios` requieren autenticación mediante JWT.
El token debe enviarse en el header `Authorization`.

Formato:
```
Authorization: Bearer <token_jwt>
```

### Requisitos de Rol
Todos los endpoints de administración (`/api/usuarios`) requieren estrictamente el rol **GOD**.
Cualquier otro rol (ADMIN, USER) recibirá una respuesta `403 Forbidden`.

## Endpoints

### 1. Listar Usuarios
Obtiene la lista de todos los usuarios registrados.

- **Método:** `GET`
- **URL:** `/api/usuarios`
- **Roles Permitidos:** `GOD`

**Respuesta Exitosa (200 OK):**
```json
{
  "ok": true,
  "message": "Usuarios obtenidos correctamente",
  "data": [
    {
      "id": 1,
      "username": "admin",
      "nombre_completo": "Administrador Principal",
      "rol": "GOD",
      "activo": true
    }
  ]
}
```

**Respuesta Error (403 Forbidden):**
```json
{
  "message": "Acceso Denegado: No tienes permisos suficientes para realizar esta acción."
}
```

### 2. Crear Usuario
Registra un nuevo usuario en el sistema.

- **Método:** `POST`
- **URL:** `/api/usuarios`
- **Roles Permitidos:** `GOD`
- **Body:**
```json
{
  "username": "nuevo_usuario",
  "password": "Password123!",
  "nombre_completo": "Juan Perez",
  "telefono": "5551234567",
  "rol": "ADMIN"
}
```

### 3. Eliminar Usuario
Elimina permanentemente un usuario de la base de datos.
**Nota:** Esta acción es irreversible.

- **Método:** `DELETE`
- **URL:** `/api/usuarios/:id`
- **Roles Permitidos:** `GOD`

**Respuesta Exitosa (200 OK):**
```json
{
  "ok": true,
  "message": "Usuario eliminado correctamente",
  "data": null
}
```

**Respuesta Error (403 Forbidden):**
- Si el usuario solicitante no es GOD.
- Si se intenta eliminar a un usuario con rol GOD.

## Auditoría
Todos los intentos de acceso no autorizado (403) son registrados en la tabla `audit_logs` con la siguiente información:
- `actor_id`: ID del usuario que intentó la acción.
- `action`: "UNAUTHORIZED_ACCESS".
- `ip_address`: Dirección IP del solicitante.
- `method`: Método HTTP (GET, POST, DELETE, etc).
- `endpoint`: Ruta solicitada.
- `attempted_role`: Rol del usuario al momento del intento.
