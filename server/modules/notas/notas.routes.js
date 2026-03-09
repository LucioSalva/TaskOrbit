const express = require('express');
const router = express.Router();
const notasController = require('./notas.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', notasController.getNotas);
router.post('/', notasController.createNota);

module.exports = router;
