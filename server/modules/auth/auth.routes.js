const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// Rutas públicas
router.post('/login', authController.login);

// Rutas protegidas
router.get('/me', authMiddleware, authController.getMe);

module.exports = router;
