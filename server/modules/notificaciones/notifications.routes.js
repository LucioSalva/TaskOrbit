const express = require('express');
const router = express.Router();
const notificationsController = require('./notifications.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleMiddleware = require('../../middlewares/role.middleware');

router.use(authMiddleware);

router.get('/', notificationsController.listNotifications);
router.get('/stream', notificationsController.stream);
router.patch('/:id/read', notificationsController.markRead);
router.post('/', roleMiddleware('ADMIN', 'GOD'), notificationsController.create);

module.exports = router;
