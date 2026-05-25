const { Trade, Tag, sequelize } = require('../models');
const { Op } = require('sequelize');

// Simple P&L calculator for Full Close (phase 1: 1:1 matching)
function calculatePnL(trade, allTrades) {
  if (trade.openClose !== 'Full Close') return null;

  const oppositeSide = trade.buySell === 'Buy' ? 'Sell' : 'Buy';
  const qty = Math.abs(parseFloat(trade.quantity));

  // Find most recent matching open trade (same market, opposite side, same qty)
  const match = allTrades
    .filter(t =>
      t.id !== trade.id &&
      t.market === trade.market &&
      t.buySell === oppositeSide &&
      Math.abs(parseFloat(t.quantity)) === qty &&
      t.openClose === 'Open' &&
      new Date(t.dateTime) < new Date(trade.dateTime)
    )
    .sort((a, b) => new Date(b.dateTime) - new Date(a.dateTime))[0];

  if (!match) return null;

  const openPrice = parseFloat(match.price);
  const closePrice = parseFloat(trade.price);
  const spread = parseFloat(trade.spread) || 0;

  let pnl;
  if (trade.buySell === 'Buy') {
    pnl = (closePrice - openPrice) * qty - spread;
  } else {
    pnl = (openPrice - closePrice) * qty - spread;
  }

  return pnl;
}

module.exports = {
  async createTrade(req, res) {
    try {
      const trade = await Trade.create(req.body);
      res.status(201).json(trade);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async getTrades(req, res) {
    try {
      const { from, to } = req.query;
      const where = {};

      if (from) where.dateTime = { [Op.gte]: new Date(from) };
      if (to) where.dateTime = { ...where.dateTime, [Op.lte]: new Date(to) };

      const trades = await Trade.findAll({
        where,
        include: Tag,
        order: [['dateTime', 'ASC']]
      });

      // Attach computed P&L
      const allTrades = await Trade.findAll({ order: [['dateTime', 'ASC']] });
      const enriched = trades.map(t => {
        const plain = t.toJSON();
        plain.computedPnl = calculatePnL(plain, allTrades);
        return plain;
      });

      res.json(enriched);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getTrade(req, res) {
    try {
      const trade = await Trade.findByPk(req.params.id, { include: Tag });
      if (!trade) return res.status(404).json({ error: 'Not found' });
      res.json(trade);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async addTag(req, res) {
    try {
      const { tradeId } = req.params;
      const { name } = req.body;

      const [tag] = await Tag.findOrCreate({ where: { name } });
      const trade = await Trade.findByPk(tradeId);
      if (!trade) return res.status(404).json({ error: 'Trade not found' });

      await trade.addTag(tag);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async removeTag(req, res) {
    try {
      const { tradeId, tagId } = req.params;
      const trade = await Trade.findByPk(tradeId);
      const tag = await Tag.findByPk(tagId);
      if (!trade || !tag) return res.status(404).json({ error: 'Not found' });

      await trade.removeTag(tag);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  async deleteTrade(req, res) {
    try {
      const { id } = req.params;
      const deleted = await Trade.destroy({ where: { id } });
      if (!deleted) return res.status(404).json({ error: 'Trade not found' });
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
};