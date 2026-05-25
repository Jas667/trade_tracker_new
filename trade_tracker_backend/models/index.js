const { Sequelize } = require('sequelize');
const config = require('../config/config.json').development;

const sequelize = new Sequelize(
  config.database,
  config.username,
  config.password,
  {
    host: config.host,
    dialect: config.dialect,
    logging: false
  }
);

const Trade = require('./trade')(sequelize);
const TradeDetail = require('./tradeDetail')(sequelize);
const Tag = require('./tag')(sequelize);

// Associations
Trade.hasMany(TradeDetail, { foreignKey: 'trade_id' });
TradeDetail.belongsTo(Trade, { foreignKey: 'trade_id' });

// Many-to-many: Trade <-> Tag
Trade.belongsToMany(Tag, { through: 'TradeTags' });
Tag.belongsToMany(Trade, { through: 'TradeTags' });

module.exports = {
  sequelize,
  Trade,
  TradeDetail,
  Tag
};