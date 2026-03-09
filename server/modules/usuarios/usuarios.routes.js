const express = require('express');
const router = express.Router();
const usuariosController = require('./usuarios.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

// Listar usuarios (GOD, ADMIN)
router.get('/', roleMiddleware('GOD', 'ADMIN'), usuariosController.getUsuarios);

// Crear usuario (GOD)
router.post('/', roleMiddleware('GOD'), usuariosController.createUsuario);

// Actualizar usuario (GOD)
router.put('/:id', roleMiddleware('GOD'), usuariosController.updateUsuario);

// Cambiar estado (GOD)
router.patch('/:id/estado', roleMiddleware('GOD'), usuariosController.toggleEstado);

// Eliminar usuario (GOD)
router.delete('/:id', roleMiddleware('GOD'), usuariosController.deleteUsuario);

module.exports = router;
