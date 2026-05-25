const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Trade = sequelize.define('Trade', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    market: {
      type: DataTypes.STRING,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('open', 'closed'),
      defaultValue: 'open'
    },
    open_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    close_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    remaining_quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0
    },
    realized_pnl: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    }
  });

  return Trade;
};