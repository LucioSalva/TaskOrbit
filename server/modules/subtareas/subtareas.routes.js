const express = require('express');
const router = express.Router();
const subtareasController = require('./subtareas.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

router.use(authMiddleware);

router.get('/', subtareasController.getSubtareas);
router.post('/', subtareasController.createSubtarea);
router.get('/:id/delete-preview', roleMiddleware('ADMIN', 'GOD'), subtareasController.getSubtareaDeletePreview);
router.delete('/:id', roleMiddleware('ADMIN', 'GOD'), subtareasController.deleteSubtarea);

module.exports = router;
