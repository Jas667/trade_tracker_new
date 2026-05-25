const { Trade, TradeDetail, sequelize } = require('../models');
const { Op } = require('sequelize');

module.exports = {
  async getPlByHour(req, res) {
    try {
      const details = await TradeDetail.findAll({
        include: [{
          model: require('../models').Trade,
          attributes: ['realized_pnl']
        }]
      });

      const buckets = {};
      for (let h = 7; h <= 16; h++) {
        buckets[`${h}-${h+1}`] = 0;
      }

      details.forEach(d => {
        const hour = new Date(d.dateTime).getHours();
        if (hour >= 7 && hour <= 16) {
          const key = `${hour}-${hour + 1}`;
          buckets[key] += parseFloat(d.Trade?.realized_pnl || 0);
        }
      });

      res.json(buckets);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getPlByDirection(req, res) {
    try {
      const trades = await Trade.findAll({
        include: [{
          model: require('../models').TradeDetail,
          limit: 1,
          order: [['dateTime', 'ASC']]
        }]
      });

      let buyPnl = 0;
      let sellPnl = 0;

      trades.forEach(trade => {
        const firstDetail = trade.TradeDetails?.[0];
        const pnl = parseFloat(trade.realized_pnl || 0);

        if (firstDetail?.buySell === 'Buy') {
          buyPnl += pnl;
        } else if (firstDetail?.buySell === 'Sell') {
          sellPnl += pnl;
        }
      });

      res.json({ buy: buyPnl, sell: sellPnl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getWinRate(req, res) {
    try {
      const trades = await Trade.findAll();
      const total = trades.length;
      const wins = trades.filter(t => parseFloat(t.realized_pnl) > 0).length;
      const winRate = total > 0 ? (wins / total) * 100 : 0;

      res.json({ winRate: winRate.toFixed(1), total });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },

  async getAverageWinLoss(req, res) {
    try {
      const trades = await Trade.findAll();
      const wins = trades.filter(t => parseFloat(t.realized_pnl) > 0).map(t => parseFloat(t.realized_pnl));
      const losses = trades.filter(t => parseFloat(t.realized_pnl) < 0).map(t => parseFloat(t.realized_pnl));

      const avgWin = wins.length > 0 ? (wins.reduce((a, b) => a + b, 0) / wins.length).toFixed(2) : 0;
      const avgLoss = losses.length > 0 ? (losses.reduce((a, b) => a + b, 0) / losses.length).toFixed(2) : 0;

      res.json({ avgWin, avgLoss });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
};