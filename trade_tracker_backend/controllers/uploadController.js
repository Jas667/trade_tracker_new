const multer = require('multer');
const pdfParse = require('pdf-parse').default || require('pdf-parse');
const { sequelize } = require('../models');
const tradeDetailCtrl = require('./tradeDetailController');

// Configure multer for PDF uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

async function parseTradeLine(line) {
  // Regex for the specific format
  // Example: Germany 40 DFT 20 May 2026 08:11 1018006587 GBP Buy Market 2.00 24376.3 -1.2000 Open
  const regex = /^(.+?)\s+(\d{2}\s+[A-Za-z]+\s+\d{4}\s+\d{2}:\d{2})\s+(\d+)\s+(\w+)\s+(Buy|Sell)\s+(Market|Stop|Limit)\s+([-\d.]+)\s+([\d.]+)\s+([-\d.]+)\s+(Open|Full Close)$/i;

  const match = line.match(regex);
  if (!match) return null;

  const [, market, dateTimeStr, reference, tradeCcy, buySell, orderType, quantity, price, spread, openClose] = match;

  // Convert date string to proper Date
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

module.exports = {
  uploadMiddleware: upload.single('pdf'),

  async uploadPDF(req, res) {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    try {
      const data = await pdfParse(req.file.buffer);
      const text = data.text;

      // Find the Spread Betting section
      const spreadBettingIndex = text.indexOf('Spread Betting');
      if (spreadBettingIndex === -1) {
        return res.status(400).json({ error: 'No "Spread Betting" section found' });
      }

      const lines = text.substring(spreadBettingIndex).split('\n');

      const trades = [];
      for (const line of lines) {
        const parsed = await parseTradeLine(line.trim());
        if (parsed) {
          trades.push(parsed);
        }
      }

      if (trades.length === 0) {
        return res.status(400).json({ error: 'No valid trades found in PDF' });
      }

      // Process trades in file order using existing logic
      const results = [];
      for (const trade of trades) {
        try {
          // Reuse the existing create logic by calling the controller method directly
          // (we simulate a request object)
          const fakeReq = { body: trade };
          const fakeRes = {
            status: () => fakeRes,
            json: (data) => { results.push(data); return fakeRes; }
          };

          await tradeDetailCtrl.createTradeDetailAndMatch(fakeReq, fakeRes);
        } catch (e) {
          console.warn('Failed to import trade:', trade.reference, e.message);
        }
      }

      res.json({
        success: true,
        imported: results.length,
        totalFound: trades.length
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to process PDF' });
    }
  }
};