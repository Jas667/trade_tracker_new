const { Trade } = require('../models');

// Multi-stage matching priority:
// 1. Oldest open trade first
// 2. If closing quantity > oldest trade's remaining quantity → use largest position instead
function findTradeToAttach(market, closingQuantity, openTrades) {
  if (!openTrades || openTrades.length === 0) return null;

  const qty = Math.abs(parseFloat(closingQuantity));

  // Stage 1: Sort by open_time (oldest first)
  const sortedByAge = [...openTrades].sort((a, b) =>
    new Date(a.open_time) - new Date(b.open_time)
  );

  const oldest = sortedByAge[0];
  const oldestRemaining = parseFloat(oldest.remaining_quantity);

  if (oldestRemaining >= qty) {
    return oldest;
  }

  // Stage 2: Oldest too small → pick largest remaining quantity
  const largest = openTrades.reduce((max, trade) =>
    parseFloat(trade.remaining_quantity) > parseFloat(max.remaining_quantity) ? trade : max
  );

  return largest;
}

async function findOpenTradesByMarket(market, transaction) {
  return await Trade.findAll({
    where: {
      market,
      status: 'open'
    },
    transaction,
    order: [['open_time', 'ASC']]
  });
}

module.exports = {
  findTradeToAttach,
  findOpenTradesByMarket
};