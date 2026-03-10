const express = require('express');
const router = express.Router();
const dashboardController = require('./dashboard.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.get('/metrics', authMiddleware, dashboardController.getMetrics);

module.exports = router;
