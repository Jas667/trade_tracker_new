const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tradeDetailController');
const uploadCtrl = require('../controllers/uploadController');

router.post('/', ctrl.createTradeDetailAndMatch);
router.get('/', ctrl.getAllTrades);
router.delete('/:id', ctrl.deleteTrade);

// PDF Upload
router.post('/upload', uploadCtrl.uploadMiddleware, uploadCtrl.uploadPDF);

module.exports = router;