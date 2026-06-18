/* Magic Mirror
 * Node Helper: MMM-Ticker
 *
 * By Christian Stengel
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");

module.exports = NodeHelper.create({
    start: function () {
        console.log("Starting node helper for: " + this.name);
        this.cache = {};
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GET_TICKER_DATA") {
            this.fetchStockData(payload.symbols);
        }
    },

    fetchStockData: async function (symbols) {
        if (!symbols || symbols.length === 0) {
            this.sendSocketNotification("TICKER_DATA_UPDATED", []);
            return;
        }

        const self = this;
        const results = [];
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        // Fetch each stock with a small delay to avoid rate limiting
        for (let i = 0; i < symbols.length; i++) {
            const symbol = symbols[i];
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=2d&interval=1d`;

            try {
                // Introduce a tiny delay (50ms) between requests to be gentle on the API
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }

                const response = await fetch(url, {
                    headers: { "User-Agent": userAgent }
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();
                
                if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
                    throw new Error("Invalid symbol or empty response");
                }

                const result = data.chart.result[0];
                const meta = result.meta;

                const price = meta.regularMarketPrice;
                const previousClose = meta.chartPreviousClose !== undefined ? meta.chartPreviousClose : (result.indicators.quote[0].close[0] || price);
                
                const change = price - previousClose;
                const changePercent = previousClose !== 0 ? (change / previousClose) * 100 : 0;
                const name = meta.longName || meta.shortName || symbol;
                const currency = meta.currency || "USD";

                const stockData = {
                    symbol: symbol,
                    name: name,
                    price: price,
                    change: change,
                    changePercent: changePercent,
                    currency: currency,
                    success: true
                };

                // Update cache
                self.cache[symbol] = stockData;
                results.push(stockData);

            } catch (error) {
                console.error(`[MMM-Ticker] Error fetching ${symbol}:`, error.message);

                // Use cache if available
                if (self.cache[symbol]) {
                    console.log(`[MMM-Ticker] Using cached data for ${symbol}`);
                    results.push(self.cache[symbol]);
                } else {
                    // Return a failed item placeholder
                    results.push({
                        symbol: symbol,
                        name: symbol,
                        price: null,
                        change: null,
                        changePercent: null,
                        currency: null,
                        success: false,
                        error: error.message
                    });
                }
            }
        }

        this.sendSocketNotification("TICKER_DATA_UPDATED", results);
    }
});
