const { Trade, TradeDetail, Tag, sequelize } = require('../models');
const { findTradeToAttach, findOpenTradesByMarket } = require('../services/tradeMatching');
const { Op } = require('sequelize');

function calculatePnL(openPrice, closePrice, qty, openBuySell) {
  const priceDiff = openBuySell === 'Buy'
    ? closePrice - openPrice
    : openPrice - closePrice;
  return priceDiff * qty;
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
          const pnl = calculatePnL(openPrice, closePrice, qty, openBuySell);

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
      const { from, to, tags } = req.query;
      const where = {};
      const include = [TradeDetail, Tag];

      if (from) where.dateTime = { [Op.gte]: new Date(from) };
      if (to) where.dateTime = { ...where.dateTime, [Op.lte]: new Date(to) };

      // Tag filtering (OR logic by tag name)
      if (tags) {
        const tagNames = tags.split(',').map(t => t.trim());
        include[1] = {
          model: Tag,
          where: { name: { [Op.in]: tagNames } }
        };
      }

      const trades = await Trade.findAll({
        where,
        include,
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
  },

  async pasteTrades(req, res) {
    try {
      const { text } = req.body;
      if (!text) return res.status(400).json({ error: 'No text provided' });

      const lines = text.split('\n').filter(l => l.trim());
      const results = [];

      for (const line of lines) {
        const parsed = parseTradeLine(line.trim());
        if (!parsed) continue;

        const fakeReq = { body: parsed };
        const fakeRes = {
          status: () => fakeRes,
          json: (data) => { results.push(data); return fakeRes; }
        };

        await module.exports.createTradeDetailAndMatch(fakeReq, fakeRes);
      }

      res.json({ success: true, imported: results.length });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  },

  updateTradeDetail,
  deleteTradeDetail,
  createTradeDetail
};

// ==================== RECALCULATION & EDIT HELPERS ====================

async function recalculateTrade(tradeId, transaction) {
  const trade = await Trade.findByPk(tradeId, { transaction });
  if (!trade) return;

  const details = await TradeDetail.findAll({
    where: { trade_id: tradeId },
    transaction,
    order: [['dateTime', 'ASC']]
  });

  let remaining = 0;
  let realizedPnl = 0;
  let status = 'open';
  let closeTime = null;

  // Simple recalculation: sum open quantities and calculate P&L from closes
  for (const d of details) {
    const qty = parseFloat(d.quantity);
    if (d.openClose === 'Open') {
      remaining += qty;
    } else {
      remaining -= Math.abs(qty);
      // Find matching open price (simplified)
      const openDetail = details.find(x => x.openClose === 'Open' && x.buySell !== d.buySell);
      if (openDetail) {
        const pnl = calculatePnL(
          parseFloat(openDetail.price),
          parseFloat(d.price),
          Math.abs(qty),
          openDetail.buySell
        );
        realizedPnl += pnl;
      }
    }
  }

  if (remaining <= 0) {
    status = 'closed';
    closeTime = details[details.length - 1]?.dateTime || null;
  }

  await trade.update({
    remaining_quantity: Math.max(0, remaining),
    realized_pnl: realizedPnl,
    status,
    close_time: closeTime
  }, { transaction });
}

async function updateTradeDetail(req, res) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const detail = await TradeDetail.findByPk(id);
    if (!detail) return res.status(404).json({ error: 'TradeDetail not found' });

    await detail.update(req.body, { transaction: t });
    await recalculateTrade(detail.trade_id, t);
    await t.commit();

    res.json({ success: true });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
}

async function deleteTradeDetail(req, res) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const detail = await TradeDetail.findByPk(id);
    if (!detail) return res.status(404).json({ error: 'TradeDetail not found' });

    const tradeId = detail.trade_id;
    await detail.destroy({ transaction: t });
    await recalculateTrade(tradeId, t);
    await t.commit();

    res.json({ success: true });
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
}

async function createTradeDetail(req, res) {
  const t = await sequelize.transaction();
  try {
    const { trade_id, ...detailData } = req.body;
    if (!trade_id) return res.status(400).json({ error: 'trade_id is required' });

    const detail = await TradeDetail.create({ ...detailData, trade_id }, { transaction: t });
    await recalculateTrade(trade_id, t);
    await t.commit();

    res.status(201).json(detail);
  } catch (err) {
    await t.rollback();
    res.status(400).json({ error: err.message });
  }
}

// Helper used by paste
function parseTradeLine(line) {
  const regex = /^(.+?)\s+(\d{2}\s+[A-Za-z]+\s+\d{4}\s+\d{2}:\d{2})\s+(\d+)\s+(\w+)\s+(Buy|Sell)\s+(Market|Stop|Limit)\s+([-\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+(Open|Full Close)$/i;
  const match = line.match(regex);
  if (!match) return null;

  const [, market, dateTimeStr, reference, tradeCcy, buySell, orderType, quantity, price, spread, openClose] = match;
  const dateTime = new Date(dateTimeStr.replace(/(\d{2})\s+([A-Za-z]+)\s+(\d{4})/, '$1 $2 $3'));

  return {
    dateTime,
    reference: parseInt(reference),
    market: market.trim(),
    tradeCcy,
    buySell,
    orderType,
    quantity: parseFloat(quantity),
    price: parseFloat(price),
    spread: parseFloat(spread),
    openClose: openClose === 'Full Close' ? 'Full Close' : 'Open'
  };
}