const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tradeDetailController');

router.post('/', ctrl.createTradeDetailAndMatch);
router.get('/', ctrl.getAllTrades);
router.delete('/:id', ctrl.deleteTrade);
router.post('/paste', ctrl.pasteTrades);

module.exports = router;