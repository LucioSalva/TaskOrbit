-- ============================================================
-- MIGRACIÓN 001: Normalización y corrección de base de datos
-- TaskOrbit · 2026-03-11
-- ============================================================
-- INSTRUCCIONES: Ejecutar en psql contra la DB TaskOrbit
-- psql -U postgres -d TaskOrbit -f 001_normalize_and_fix.sql
-- ============================================================

BEGIN;

-- ===========================================================
-- 1. TABLA notas – eliminar columnas redundantes/duplicadas
-- ===========================================================
-- Problema: la tabla tiene pares duplicados:
--   user_id  / usuario_id       (mismo usuario, solo usuario_id tiene FK)
--   created_at / fecha_creacion  (mismo timestamp)
--   updated_at / fecha_actualizacion (mismo timestamp)
--   referencia_id / actividad_id  (misma entidad relacionada)

-- 1.1 Migrar datos huérfanos antes de eliminar columnas
UPDATE notas
   SET usuario_id = user_id
 WHERE usuario_id IS NULL AND user_id IS NOT NULL;

UPDATE notas
   SET referencia_id = actividad_id
 WHERE referencia_id IS NULL AND actividad_id IS NOT NULL;

-- 1.2 Eliminar columnas redundantes
ALTER TABLE notas DROP COLUMN IF EXISTS user_id;
ALTER TABLE notas DROP COLUMN IF EXISTS fecha_creacion;
ALTER TABLE notas DROP COLUMN IF EXISTS fecha_actualizacion;
ALTER TABLE notas DROP COLUMN IF EXISTS actividad_id;

-- 1.3 Garantizar NOT NULL en usuario_id (ya tiene FK a usuarios)
ALTER TABLE notas ALTER COLUMN usuario_id SET NOT NULL;

-- 1.4 Agregar CHECK constraint faltante en columna tipo
ALTER TABLE notas ADD CONSTRAINT notas_tipo_check
  CHECK (tipo IS NULL OR tipo = ANY(ARRAY['personal', 'actividad']));

-- 1.5 Agregar índice en usuario_id (ya que se filtran notas por usuario)
CREATE INDEX IF NOT EXISTS idx_notas_usuario_id ON notas (usuario_id);

-- ===========================================================
-- 2. TABLA usuarios – campos faltantes
-- ===========================================================
-- Problema: falta email (requerido para notificaciones) y updated_at

ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS email VARCHAR(120);
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Índice único en email (solo para filas donde email no es NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email_unique
  ON usuarios (email)
  WHERE email IS NOT NULL;

-- Trigger para actualizar updated_at automáticamente en usuarios
DROP TRIGGER IF EXISTS trg_usuarios_updated_at ON usuarios;
CREATE TRIGGER trg_usuarios_updated_at
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ===========================================================
-- 3. FK CONSTRAINTS FALTANTES
-- ===========================================================

-- 3.1 notifications.user_id → usuarios(id)
ALTER TABLE notifications
  ADD CONSTRAINT notifications_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES usuarios(id) ON DELETE CASCADE;

-- 3.2 proyectos.usuario_asignado_id → usuarios(id)
--     ON DELETE RESTRICT: no se puede eliminar un usuario con proyectos asignados
ALTER TABLE proyectos
  ADD CONSTRAINT proyectos_usuario_asignado_fkey
  FOREIGN KEY (usuario_asignado_id) REFERENCES usuarios(id) ON DELETE RESTRICT;

-- 3.3 tareas.usuario_asignado_id → usuarios(id)
--     ON DELETE SET NULL: si se elimina el usuario, la tarea queda sin asignado
ALTER TABLE tareas
  ADD CONSTRAINT tareas_usuario_asignado_fkey
  FOREIGN KEY (usuario_asignado_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- 3.4 audit_logs.actor_id → usuarios(id)
ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_actor_fkey
  FOREIGN KEY (actor_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- ===========================================================
-- 4. CHECK CONSTRAINT FALTANTE en notifications.status
-- ===========================================================
-- Problema: la columna status no tiene validación de valores permitidos

ALTER TABLE notifications
  ADD CONSTRAINT notifications_status_check
  CHECK (status = ANY(ARRAY['queued', 'sent', 'failed', 'read']));

-- ===========================================================
-- 5. ÍNDICES FALTANTES para performance
-- ===========================================================

CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications (status);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
  ON notifications (created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor
  ON audit_logs (actor_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_proyectos_created_by
  ON proyectos (created_by);

CREATE INDEX IF NOT EXISTS idx_tareas_created_by
  ON tareas (created_by);

CREATE INDEX IF NOT EXISTS idx_subtareas_created_by
  ON subtareas (created_by);

-- Índice compuesto frecuente: notas por scope + usuario
CREATE INDEX IF NOT EXISTS idx_notas_scope_usuario
  ON notas (scope, usuario_id);

-- ===========================================================
-- 6. VISTAS – actualizar para reflejar cambios
-- ===========================================================

-- 6.1 vw_login: corregir para evitar filas duplicadas con múltiples roles
--     Usar DISTINCT ON para retornar solo el rol más alto por usuario
DROP VIEW IF EXISTS vw_login;
CREATE VIEW public.vw_login AS
SELECT DISTINCT ON (u.id)
  u.id,
  u.username,
  u.password_hash,
  u.nombre_completo,
  r.nombre AS rol,
  u.activo
FROM public.usuarios u
JOIN public.usuarios_roles ur ON u.id = ur.usuario_id
JOIN public.roles r ON r.id = ur.rol_id
ORDER BY
  u.id,
  CASE
    WHEN UPPER(r.nombre) LIKE '%GOD%'                                   THEN 1
    WHEN UPPER(r.nombre) LIKE 'ADMIN%' OR UPPER(r.nombre) LIKE '%ADMINISTR%' THEN 2
    WHEN UPPER(r.nombre) LIKE 'USER%'  OR UPPER(r.nombre) LIKE 'USUARIO%'    THEN 3
    ELSE 99
  END;

-- 6.2 vw_usuarios_roles: incluir email en la vista
DROP VIEW IF EXISTS vw_usuarios_roles;
CREATE VIEW public.vw_usuarios_roles AS
SELECT
  u.id,
  u.username,
  u.nombre_completo,
  u.email,
  u.telefono,
  r.nombre AS rol,
  u.activo,
  u.created_at,
  u.updated_at
FROM public.usuarios u
JOIN public.usuarios_roles ur ON u.id = ur.usuario_id
JOIN public.roles r ON r.id = ur.rol_id;

COMMIT;

-- ============================================================
-- VERIFICACIÓN POST-MIGRACIÓN (ejecutar manualmente)
-- ============================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'notas'
--  ORDER BY ordinal_position;
--
-- SELECT conname, contype FROM pg_constraint
--  WHERE conrelid = 'notas'::regclass;
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'notas';
