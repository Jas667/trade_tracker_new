const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tradeDetailController');

router.post('/', ctrl.createTradeDetailAndMatch);
router.get('/', ctrl.getAllTrades);

module.exports = router;