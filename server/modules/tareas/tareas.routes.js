const express = require('express');
const router = express.Router();
const tareasController = require('./tareas.controller');
const subtareasController = require('../subtareas/subtareas.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

router.use(authMiddleware);

router.get('/', tareasController.getTareas);
router.get('/:id/delete-preview', roleMiddleware('ADMIN', 'GOD'), tareasController.getTareaDeletePreview);
router.get('/:id', tareasController.getTareaById);
router.get('/:id/subtareas', subtareasController.getSubtareasByTarea);
router.post('/', tareasController.createTarea);
router.post('/:id/subtareas', subtareasController.createSubtareaForTarea);
router.put('/:id', tareasController.updateTarea);
router.delete('/:id', roleMiddleware('ADMIN', 'GOD'), tareasController.deleteTarea);

module.exports = router;
