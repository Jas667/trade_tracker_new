const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const TradeDetail = sequelize.define('TradeDetail', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    dateTime: {
      type: DataTypes.DATE,
      allowNull: false
    },
    reference: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    market: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tradeCcy: {
      type: DataTypes.STRING,
      allowNull: false
    },
    buySell: {
      type: DataTypes.ENUM('Buy', 'Sell'),
      allowNull: false
    },
    orderType: {
      type: DataTypes.STRING,
      allowNull: false
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    price: {
      type: DataTypes.DECIMAL(12, 4),
      allowNull: false
    },
    spread: {
      type: DataTypes.DECIMAL(10, 4),
      allowNull: false,
      defaultValue: 0
    },
    openClose: {
      type: DataTypes.ENUM('Open', 'Full Close'),
      allowNull: false
    }
  });

  return TradeDetail;
};