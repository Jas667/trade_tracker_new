const { Trade, TradeDetail, Tag, sequelize } = require('../models');
const { findTradeToAttach, findOpenTradesByMarket } = require('../services/tradeMatching');
const { Op } = require('sequelize');

function calculatePnL(openPrice, closePrice, qty, spread, openBuySell) {
  const priceDiff = openBuySell === 'Buy'
    ? closePrice - openPrice
    : openPrice - closePrice;
  return (priceDiff * qty) - spread;
}

module.exports = {
  async createTradeDetailAndMatch(req, res) {
    const t = await sequelize.transaction();
    try {
      const detailData = req.body;

      // Create the TradeDetail first
      const detail = await TradeDetail.create(detailData, { transaction: t });

      let trade;
      const isClosing = detailData.openClose === 'Full Close';
      const qty = Math.abs(parseFloat(detailData.quantity));

      if (!isClosing) {
        // Opening leg → always create new Trade
        trade = await Trade.create({
          market: detailData.market,
          status: 'open',
          open_time: detailData.dateTime,
          remaining_quantity: qty,
          realized_pnl: 0
        }, { transaction: t });

        await detail.update({ trade_id: trade.id }, { transaction: t });
      } else {
        // Closing leg → use matching logic
        const openTrades = await findOpenTradesByMarket(detailData.market, t);

        const matchedTrade = findTradeToAttach(detailData.market, qty, openTrades);

        if (!matchedTrade) {
          await t.rollback();
          return res.status(400).json({ error: 'No open trade found to close' });
        }

        trade = matchedTrade;

        // Calculate P&L against this trade's average open price (simplified: use first detail for now)
        const openDetails = await TradeDetail.findAll({
          where: { trade_id: trade.id, openClose: 'Open' },
          transaction: t,
          order: [['dateTime', 'ASC']]
        });

        if (openDetails.length > 0) {
          const openPrice = parseFloat(openDetails[0].price);
          const openBuySell = openDetails[0].buySell;
          const closePrice = parseFloat(detailData.price);
          const spread = parseFloat(detailData.spread) || 0;
          const pnl = calculatePnL(openPrice, closePrice, qty, spread, openBuySell);

          const newRemaining = parseFloat(trade.remaining_quantity) - qty;
          const newPnl = parseFloat(trade.realized_pnl) + pnl;

          const updateData = {
            remaining_quantity: Math.max(0, newRemaining),
            realized_pnl: newPnl
          };

          if (newRemaining <= 0) {
            updateData.status = 'closed';
            updateData.close_time = detailData.dateTime;
          }

          await trade.update(updateData, { transaction: t });
        }

        await detail.update({ trade_id: trade.id }, { transaction: t });
      }

      await t.commit();

      // Return enriched result
      const result = await Trade.findByPk(trade.id, {
        include: [TradeDetail, Tag]
      });

      res.status(201).json(result);
    } catch (err) {
      await t.rollback();
      res.status(400).json({ error: err.message });
    }
  },

  async getAllTrades(req, res) {
    try {
      const trades = await Trade.findAll({
        include: [TradeDetail, Tag],
        order: [['open_time', 'DESC']]
      });
      res.json(trades);
    } catch (err) {
      res.status(500).json({ error: err.message });
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