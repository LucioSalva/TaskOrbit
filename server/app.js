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
app.use(cors()); // Habilita CORS para Angular
app.use(express.json()); // Parser para JSON bodies
app.use(express.urlencoded({ extended: true }));

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
  res.send('TaskOrbit API is running');
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
