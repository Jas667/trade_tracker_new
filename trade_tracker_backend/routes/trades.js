const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tradeDetailController');

router.post('/', ctrl.createTradeDetailAndMatch);
router.get('/', ctrl.getAllTrades);
router.delete('/:id', ctrl.deleteTrade);
router.post('/paste', ctrl.pasteTrades);

// TradeDetail edit endpoints
router.put('/details/:id', ctrl.updateTradeDetail);
router.delete('/details/:id', ctrl.deleteTradeDetail);
router.post('/details', ctrl.createTradeDetail);

module.exports = router;