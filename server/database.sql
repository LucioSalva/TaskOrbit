DROP VIEW IF EXISTS vw_usuarios_roles;
DROP VIEW IF EXISTS vw_login;

CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(50) UNIQUE NOT NULL
);

INSERT INTO roles (nombre) VALUES ('GOD'), ('ADMIN'), ('USER') ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS usuarios_roles (
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    rol_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (usuario_id, rol_id)
);

INSERT INTO usuarios (username, password_hash, nombre_completo, telefono, activo)
SELECT 'admin', '$2b$10$pAHVtzmZc6bGWCdxk5sehOiKL/Lxsi/ANVA3C26/xDmgeWbDk2knK', 'Administrador Principal', '0000000000', TRUE
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'admin');

INSERT INTO usuarios (username, password_hash, nombre_completo, telefono, activo)
SELECT 'lucifer', '$2b$10$D1UMR6qHEUKNKQhRZ5OW7OI1nrDY9W3TaJIeYT22jORLOWNoXAB5C', 'lucifer supremo', '0000000000', TRUE
WHERE NOT EXISTS (SELECT 1 FROM usuarios WHERE username = 'lucifer');

UPDATE usuarios
SET password_hash = '$2b$10$D1UMR6qHEUKNKQhRZ5OW7OI1nrDY9W3TaJIeYT22jORLOWNoXAB5C',
    activo = TRUE
WHERE username = 'lucifer';

INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT u.id, r.id
FROM usuarios u
JOIN roles r ON r.nombre = 'ADMIN'
WHERE u.username = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM usuarios_roles ur WHERE ur.usuario_id = u.id AND ur.rol_id = r.id
  );

DELETE FROM usuarios_roles
WHERE rol_id = (SELECT id FROM roles WHERE nombre = 'GOD')
  AND usuario_id <> (SELECT id FROM usuarios WHERE username = 'lucifer');

INSERT INTO usuarios_roles (usuario_id, rol_id)
SELECT u.id, r.id
FROM usuarios u
JOIN roles r ON r.nombre = 'GOD'
WHERE u.username = 'lucifer'
  AND NOT EXISTS (
    SELECT 1 FROM usuarios_roles ur WHERE ur.usuario_id = u.id AND ur.rol_id = r.id
  );

CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_id INTEGER,
    details TEXT,
    ip_address VARCHAR(100),
    method VARCHAR(20),
    endpoint VARCHAR(200),
    attempted_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proyectos (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    estado VARCHAR(20) NOT NULL DEFAULT 'por_hacer',
    fecha_inicio DATE,
    fecha_fin DATE,
    estimacion_minutos INTEGER,
    usuario_asignado_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT proyectos_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT proyectos_estado_check CHECK (estado IN ('por_hacer', 'haciendo', 'terminada', 'enterado', 'ocupado', 'aceptada')),
    CONSTRAINT proyectos_fechas_check CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'media';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'por_hacer';
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE proyectos ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
UPDATE proyectos SET created_by = COALESCE(created_by, usuario_asignado_id) WHERE created_by IS NULL;

CREATE TABLE IF NOT EXISTS tareas (
    id SERIAL PRIMARY KEY,
    proyecto_id INTEGER NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    estado VARCHAR(20) NOT NULL DEFAULT 'por_hacer',
    fecha_inicio DATE,
    fecha_fin DATE,
    estimacion_minutos INTEGER,
    usuario_asignado_id INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT tareas_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT tareas_estado_check CHECK (estado IN ('por_hacer', 'haciendo', 'terminada', 'enterado', 'ocupado', 'aceptada')),
    CONSTRAINT tareas_fechas_check CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

ALTER TABLE tareas ADD COLUMN IF NOT EXISTS nombre VARCHAR(120);
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'media';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'por_hacer';
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE tareas ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
UPDATE tareas SET nombre = COALESCE(nombre, titulo) WHERE nombre IS NULL;
UPDATE tareas SET created_by = COALESCE(created_by, usuario_asignado_id) WHERE created_by IS NULL;

CREATE TABLE IF NOT EXISTS subtareas (
    id SERIAL PRIMARY KEY,
    tarea_id INTEGER NOT NULL REFERENCES tareas(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL,
    descripcion TEXT,
    prioridad VARCHAR(10) NOT NULL DEFAULT 'media',
    estado VARCHAR(20) NOT NULL DEFAULT 'por_hacer',
    fecha_inicio DATE,
    fecha_fin DATE,
    estimacion_minutos INTEGER,
    created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT subtareas_prioridad_check CHECK (prioridad IN ('baja', 'media', 'alta', 'critica')),
    CONSTRAINT subtareas_estado_check CHECK (estado IN ('por_hacer', 'haciendo', 'terminada', 'enterado', 'ocupado', 'aceptada')),
    CONSTRAINT subtareas_fechas_check CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS nombre VARCHAR(120);
ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS prioridad VARCHAR(10) NOT NULL DEFAULT 'media';
ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'por_hacer';
ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
ALTER TABLE subtareas ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES usuarios(id) ON DELETE SET NULL;
UPDATE subtareas SET nombre = COALESCE(nombre, titulo) WHERE nombre IS NULL;
UPDATE subtareas s
SET created_by = COALESCE(s.created_by, t.created_by)
FROM tareas t
WHERE s.tarea_id = t.id AND s.created_by IS NULL;

CREATE TABLE IF NOT EXISTS notas (
    id SERIAL PRIMARY KEY,
    scope VARCHAR(20) NOT NULL,
    referencia_id INTEGER,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo VARCHAR(160),
    tipo VARCHAR(20),
    actividad_id INTEGER,
    usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    CONSTRAINT notas_scope_check CHECK (scope IN ('personal', 'proyecto', 'tarea', 'subtarea')),
    CONSTRAINT notas_tipo_check CHECK (tipo IS NULL OR tipo IN ('personal', 'actividad'))
);

ALTER TABLE notas ADD COLUMN IF NOT EXISTS titulo VARCHAR(160);
ALTER TABLE notas ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
ALTER TABLE notas ADD COLUMN IF NOT EXISTS actividad_id INTEGER;
ALTER TABLE notas ADD COLUMN IF NOT EXISTS usuario_id INTEGER REFERENCES usuarios(id) ON DELETE CASCADE;
ALTER TABLE notas ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE notas ADD COLUMN IF NOT EXISTS fecha_creacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE notas ADD COLUMN IF NOT EXISTS fecha_actualizacion TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

UPDATE notas
SET usuario_id = COALESCE(usuario_id, user_id),
    actividad_id = COALESCE(actividad_id, referencia_id),
    tipo = COALESCE(tipo, CASE WHEN scope = 'personal' THEN 'personal' ELSE 'actividad' END),
    titulo = COALESCE(titulo, 'Nota'),
    fecha_creacion = COALESCE(fecha_creacion, created_at),
    fecha_actualizacion = COALESCE(fecha_actualizacion, updated_at, created_at);

CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    type VARCHAR(40) NOT NULL,
    title VARCHAR(160) NOT NULL,
    message TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL DEFAULT 'info',
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app',
    entity_type VARCHAR(20),
    entity_id INTEGER,
    read BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    delivered_at TIMESTAMP,
    CONSTRAINT notifications_severity_check CHECK (severity IN ('info', 'warning', 'danger')),
    CONSTRAINT notifications_channel_check CHECK (channel IN ('in_app', 'email', 'push', 'whatsapp'))
);

CREATE INDEX IF NOT EXISTS idx_proyectos_usuario ON proyectos(usuario_asignado_id);
CREATE INDEX IF NOT EXISTS idx_proyectos_estado ON proyectos(estado);
CREATE INDEX IF NOT EXISTS idx_proyectos_deleted ON proyectos(deleted_at);
CREATE INDEX IF NOT EXISTS idx_tareas_proyecto ON tareas(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_tareas_usuario ON tareas(usuario_asignado_id);
CREATE INDEX IF NOT EXISTS idx_tareas_estado ON tareas(estado);
CREATE INDEX IF NOT EXISTS idx_tareas_deleted ON tareas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_subtareas_tarea ON subtareas(tarea_id);
CREATE INDEX IF NOT EXISTS idx_subtareas_deleted ON subtareas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notas_scope_ref ON notas(scope, referencia_id);
CREATE INDEX IF NOT EXISTS idx_notas_user ON notas(user_id);
CREATE INDEX IF NOT EXISTS idx_notas_usuario ON notas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notas_actividad ON notas(actividad_id);
CREATE INDEX IF NOT EXISTS idx_notas_deleted ON notas(deleted_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_notas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_updated_at ON proyectos;
CREATE TRIGGER trg_proyectos_updated_at
BEFORE UPDATE ON proyectos
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_tareas_updated_at ON tareas;
CREATE TRIGGER trg_tareas_updated_at
BEFORE UPDATE ON tareas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_subtareas_updated_at ON subtareas;
CREATE TRIGGER trg_subtareas_updated_at
BEFORE UPDATE ON subtareas
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_notas_updated_at ON notas;
CREATE TRIGGER trg_notas_updated_at
BEFORE UPDATE ON notas
FOR EACH ROW
EXECUTE FUNCTION set_notas_updated_at();

CREATE OR REPLACE FUNCTION audit_entity_changes()
RETURNS TRIGGER AS $$
DECLARE
    action_type TEXT;
    details_payload TEXT;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        action_type := TG_TABLE_NAME || '_CREATE';
        details_payload := row_to_json(NEW)::text;
        INSERT INTO audit_logs (actor_id, action, target_id, details)
        VALUES (NULL, upper(action_type), NEW.id, details_payload);
        RETURN NEW;
    ELSIF (TG_OP = 'UPDATE') THEN
        action_type := TG_TABLE_NAME || '_UPDATE';
        details_payload := json_build_object('before', row_to_json(OLD), 'after', row_to_json(NEW))::text;
        INSERT INTO audit_logs (actor_id, action, target_id, details)
        VALUES (NULL, upper(action_type), NEW.id, details_payload);
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        action_type := TG_TABLE_NAME || '_DELETE';
        details_payload := row_to_json(OLD)::text;
        INSERT INTO audit_logs (actor_id, action, target_id, details)
        VALUES (NULL, upper(action_type), OLD.id, details_payload);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_proyectos_audit ON proyectos;
CREATE TRIGGER trg_proyectos_audit
AFTER INSERT OR UPDATE OR DELETE ON proyectos
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

DROP TRIGGER IF EXISTS trg_tareas_audit ON tareas;
CREATE TRIGGER trg_tareas_audit
AFTER INSERT OR UPDATE OR DELETE ON tareas
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

DROP TRIGGER IF EXISTS trg_subtareas_audit ON subtareas;
CREATE TRIGGER trg_subtareas_audit
AFTER INSERT OR UPDATE OR DELETE ON subtareas
FOR EACH ROW
EXECUTE FUNCTION audit_entity_changes();

-- Views
CREATE OR REPLACE VIEW vw_usuarios_roles AS
SELECT 
    u.id, 
    u.username, 
    u.nombre_completo, 
    u.telefono, 
    r.nombre as rol, 
    u.activo
FROM usuarios u
JOIN usuarios_roles ur ON u.id = ur.usuario_id
JOIN roles r ON r.id = ur.rol_id;

CREATE OR REPLACE VIEW vw_proyectos AS
SELECT
    p.id,
    p.nombre,
    p.descripcion,
    p.prioridad,
    p.estado,
    p.fecha_inicio,
    p.fecha_fin,
    p.estimacion_minutos,
    p.usuario_asignado_id,
    p.created_by,
    u.nombre_completo AS usuario_asignado_nombre,
    p.created_at,
    p.updated_at
FROM proyectos p
JOIN usuarios u ON u.id = p.usuario_asignado_id
WHERE p.deleted_at IS NULL;

CREATE OR REPLACE VIEW vw_tareas AS
SELECT
    t.id,
    t.proyecto_id,
    t.nombre,
    t.descripcion,
    t.prioridad,
    t.estado,
    t.fecha_inicio,
    t.fecha_fin,
    t.estimacion_minutos,
    t.usuario_asignado_id,
    t.created_by,
    u.nombre_completo AS usuario_asignado_nombre,
    t.created_at,
    t.updated_at
FROM tareas t
LEFT JOIN usuarios u ON u.id = t.usuario_asignado_id
WHERE t.deleted_at IS NULL;

CREATE OR REPLACE VIEW vw_login AS
SELECT 
    u.id, 
    u.username, 
    u.password_hash, 
    u.nombre_completo, 
    r.nombre as rol, 
    u.activo
FROM usuarios u
JOIN usuarios_roles ur ON u.id = ur.usuario_id
JOIN roles r ON r.id = ur.rol_id;
