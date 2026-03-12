const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Middlewares Globales
const errorHandler = require('./middlewares/error.middleware');
const notFoundHandler = require('./middlewares/not-found.middleware');

// Rutas
const authRoutes = require('./modules/auth/auth.routes');
const usuariosRoutes = require('./modules/usuarios/usuarios.routes');
const proyectosRoutes = require('./modules/proyectos/proyectos.routes');
const tareasRoutes = require('./modules/tareas/tareas.routes');
const subtareasRoutes = require('./modules/subtareas/subtareas.routes');
const notificationsRoutes = require('./modules/notificaciones/notifications.routes');
const notasRoutes = require('./modules/notas/notas.routes');
const dashboardRoutes = require('./modules/dashboard/dashboard.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de Middlewares
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:4200', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS bloqueado para origen: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Servir archivos estáticos del frontend (Angular)
app.use(express.static(path.join(__dirname, '../dist/task-orbit/browser')));

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/proyectos', proyectosRoutes);
app.use('/api/tareas', tareasRoutes);
app.use('/api/subtareas', subtareasRoutes);
app.use('/api/notificaciones', notificationsRoutes);
app.use('/api/notas', notasRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Ruta base API (opcional, para verificar estado)
app.get('/api', (req, res) => {
  res.json({ status: 'ok', app: 'TaskOrbit API', version: '1.0.0' });
});

app.use('/api', notFoundHandler);

// Cualquier otra ruta que no empiece por /api devuelve el index.html de Angular
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../dist/task-orbit/browser/index.html'));
});

// Middleware Global de Errores - Debe ir al final de todo
app.use(errorHandler);

// Iniciar servidor solo si no es test
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;
