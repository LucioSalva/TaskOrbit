const express = require('express');
const router = express.Router();
const proyectosController = require('./proyectos.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

router.use(authMiddleware);

router.get('/', proyectosController.getProyectos);
router.get('/:id/delete-preview', roleMiddleware('ADMIN', 'GOD'), proyectosController.getProyectoDeletePreview);
router.get('/:id', proyectosController.getProyectoById);
router.post('/', proyectosController.createProyecto);
router.put('/:id', proyectosController.updateProyecto);
router.delete('/:id', roleMiddleware('ADMIN', 'GOD'), proyectosController.deleteProyecto);

module.exports = router;
