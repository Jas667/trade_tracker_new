require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');
const tradeRoutes = require('./routes/trades');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/trades', tradeRoutes);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await sequelize.sync({ alter: true });
    console.log('Database synced (Trade + TradeDetail)');
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (err) {
    console.error('Failed to start:', err);
  }
}

start();