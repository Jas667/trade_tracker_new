const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tradeDetailController');
const { Tag } = require('../models');

// Existing routes
router.post('/', ctrl.createTradeDetailAndMatch);
router.get('/', ctrl.getAllTrades);
router.delete('/:id', ctrl.deleteTrade);
router.post('/paste', ctrl.pasteTrades);

// TradeDetail edit endpoints
router.put('/details/:id', ctrl.updateTradeDetail);
router.delete('/details/:id', ctrl.deleteTradeDetail);
router.post('/details', ctrl.createTradeDetail);

// Global Tags
router.get('/tags', async (req, res) => {
  const tags = await Tag.findAll({ order: [['name', 'ASC']] });
  res.json(tags);
});

router.post('/tags', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const [tag] = await Tag.findOrCreate({ where: { name } });
  res.json(tag);
});

module.exports = router;