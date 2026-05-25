const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/tradeDetailController');
const analytics = require('../controllers/analyticsController');
const { Tag, Trade } = require('../models');

// Existing routes
router.post('/', ctrl.createTradeDetailAndMatch);
router.get('/', ctrl.getAllTrades);

// Global Tags (must come before /:id to avoid being caught by the dynamic route)
router.get('/tags', async (req, res) => {
  try {
    console.log('GET /tags called');
    const { Tag } = require('../models');
    const tags = await Tag.findAll({ order: [['name', 'ASC']] });
    console.log('GET /tags success, count:', tags.length);
    res.json(tags);
  } catch (err) {
    console.error('GET /tags ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});
 
router.post('/tags', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { Tag } = require('../models');
    const [tag] = await Tag.findOrCreate({ where: { name } });
    res.json(tag);
  } catch (err) {
    console.error('POST /tags ERROR:', err);
    res.status(500).json({ error: err.message });
  }
});

// Dynamic route must come AFTER specific routes like /tags
router.get('/:id', async (req, res) => {
  try {
    const trade = await require('../models').Trade.findByPk(req.params.id, {
      include: [require('../models').TradeDetail, require('../models').Tag]
    });
    if (!trade) return res.status(404).json({ error: 'Trade not found' });
    res.json(trade);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router.delete('/:id', ctrl.deleteTrade);
router.post('/paste', ctrl.pasteTrades);
 
// TradeDetail edit endpoints
router.put('/details/:id', ctrl.updateTradeDetail);
router.delete('/details/:id', ctrl.deleteTradeDetail);
router.post('/details', ctrl.createTradeDetail);

// Add tag to a trade
router.post('/:tradeId/tags', async (req, res) => {
  try {
    const { tradeId } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const trade = await Trade.findByPk(tradeId);
    if (!trade) return res.status(404).json({ error: 'Trade not found' });

    const [tag] = await Tag.findOrCreate({ where: { name } });
    await trade.addTag(tag);

    res.json({ success: true, tag });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a tag globally
router.delete('/tags/:id', async (req, res) => {
  try {
    const tag = await Tag.findByPk(req.params.id);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
    await tag.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Remove tag from trade (and delete globally if last usage)
router.delete('/:tradeId/tags/:tagId', async (req, res) => {
  try {
    const { tradeId, tagId } = req.params;
    const trade = await Trade.findByPk(tradeId);
    const tag = await Tag.findByPk(tagId);
    if (!trade || !tag) return res.status(404).json({ error: 'Not found' });

    await trade.removeTag(tag);

    // Check if tag is still used anywhere
    const count = await tag.countTrades();
    if (count === 0) {
      await tag.destroy();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Analytics
router.get('/analytics/pl-by-hour', analytics.getPlByHour);
router.get('/analytics/pl-by-direction', analytics.getPlByDirection);
router.get('/analytics/win-rate', analytics.getWinRate);
router.get('/analytics/avg-win-loss', analytics.getAverageWinLoss);

module.exports = router;