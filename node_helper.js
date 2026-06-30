/* Magic Mirror
 * Node Helper: MMM-Ticker
 *
 * By Christian Stengel
 * MIT Licensed.
 */

const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
    start: function () {
        console.log("Starting node helper for: " + this.name);
        this.cache = {};
        this.sentAlertsFile = path.join(__dirname, "sent_alerts.json");
        this.sentAlerts = this.loadSentAlerts();
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GET_TICKER_DATA") {
            this.fetchStockData(payload);
        }
    },

    fetchStockData: async function (payload) {
        const symbols = payload.symbols;
        if (!symbols || symbols.length === 0) {
            this.sendSocketNotification("TICKER_DATA_UPDATED", []);
            return;
        }

        const self = this;
        const results = [];
        const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

        // Fetch each stock with a small delay to avoid rate limiting
        for (let i = 0; i < symbols.length; i++) {
            const symbol = typeof symbols[i] === "string" ? symbols[i] : symbols[i].symbol;
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

                // Pushover drop & rise alarm check
                if (payload.pushover && payload.pushover.enabled) {
                    const closeArray = result.indicators.quote && result.indicators.quote[0] ? result.indicators.quote[0].close : null;
                    const price2DaysAgo = meta.chartPreviousClose !== undefined ? meta.chartPreviousClose : (closeArray && closeArray[0] ? closeArray[0] : null);

                    if (price2DaysAgo !== null && price2DaysAgo !== 0 && price !== null) {
                        const change2dPercent = ((price - price2DaysAgo) / price2DaysAgo) * 100;

                        // Check for drop alert
                        if (payload.pushover.thresholdDrop !== null && payload.pushover.thresholdDrop !== undefined) {
                            if (change2dPercent <= -payload.pushover.thresholdDrop) {
                                await self.checkAndSendPushover(symbol, name, price, currency, change2dPercent, "drop", payload.pushover);
                            }
                        }

                        // Check for rise alert
                        if (payload.pushover.thresholdRise !== null && payload.pushover.thresholdRise !== undefined) {
                            if (change2dPercent >= payload.pushover.thresholdRise) {
                                await self.checkAndSendPushover(symbol, name, price, currency, change2dPercent, "rise", payload.pushover);
                            }
                        }
                    }
                }

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
    },

    checkAndSendPushover: async function (symbol, name, price, currency, changePercent, alertType, pushoverConfig) {
        const todayStr = this.getLocalDateString();
        const memoryKey = `${symbol}_${alertType}`;

        // Check if already sent today
        if (this.sentAlerts[memoryKey] === todayStr) {
            return;
        }

        const displayName = name && name !== symbol ? `${name} (${symbol})` : symbol;
        const formattedPercent = Math.abs(changePercent).toFixed(2);
        const formattedPrice = price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const currencySymbol = currency || "";

        let title, message;
        if (alertType === "drop") {
            title = `${displayName} ist gefallen`;
            message = `${displayName} ist um ${formattedPercent}% gefallen in 2 Tagen`;
        } else {
            title = `${displayName} ist gestiegen`;
            message = `${displayName} ist um ${formattedPercent}% gestiegen in 2 Tagen`;
        }

        const yahooUrl = `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}`;
        const success = await this.sendPushoverNotification(pushoverConfig.token, pushoverConfig.user, message, title, yahooUrl);
        if (success) {
            this.sentAlerts[memoryKey] = todayStr;
            this.saveSentAlerts();
        }
    },

    sendPushoverNotification: async function (token, user, message, title, yahooUrl) {
        const url = "https://api.pushover.net/1/messages.json";
        const params = {
            token: token,
            user: user,
            message: message,
            title: title,
            priority: 0
        };

        if (yahooUrl) {
            params.url = yahooUrl;
            params.url_title = "Yahoo Finance";
        }

        const body = new URLSearchParams(params);

        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: body.toString()
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Pushover HTTP error: ${response.status} - ${errText}`);
            }

            const data = await response.json();
            if (data.status !== 1) {
                throw new Error(`Pushover API error: ${JSON.stringify(data.errors || data)}`);
            }

            console.log(`[MMM-Ticker] Pushover alert sent successfully: ${message}`);
            return true;
        } catch (error) {
            console.error(`[MMM-Ticker] Failed to send Pushover alert:`, error.message);
            return false;
        }
    },

    getLocalDateString: function () {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    },

    loadSentAlerts: function () {
        try {
            if (fs.existsSync(this.sentAlertsFile)) {
                const data = fs.readFileSync(this.sentAlertsFile, "utf8");
                return JSON.parse(data);
            }
        } catch (error) {
            console.error("[MMM-Ticker] Error loading sent alerts:", error.message);
        }
        return {};
    },

    saveSentAlerts: function () {
        try {
            fs.writeFileSync(this.sentAlertsFile, JSON.stringify(this.sentAlerts, null, 2), "utf8");
        } catch (error) {
            console.error("[MMM-Ticker] Error saving sent alerts:", error.message);
        }
    }
});
