/* Magic Mirror
 * Module: MMM-Ticker
 *
 * By Christian Stengel
 * MIT Licensed.
 */

Module.register("MMM-Ticker", {
    defaults: {
        symbols: ["AAPL", "MSFT", "TSLA", "SAP.DE", "ALV.DE", "^GDAXI"],
        updateInterval: 10 * 60 * 1000, // 10 minutes
        mode: "ticker", // "ticker" or "table"
        columns: 3, // Number of columns in table mode
        speed: "medium", // "slow" (60s), "medium" (30s), "fast" (15s) for full scroll loop
        showChangePercent: true,
        showChangeValue: true,
        showSymbol: true,
        showName: false,
        stripSuffix: true,
        colored: true,
        customNames: {},
        currencySymbols: {
            "USD": "$",
            "EUR": "€",
            "GBP": "£",
            "JPY": "¥",
            "CHF": "CHF"
        },
        enablePushover: false,
        pushoverThresholdDrop: 5,
        pushoverThresholdRise: null,
        pushoverApiToken: "",
        pushoverUserKey: "",
        showPrice: true
    },

    start: function () {
        Log.info("Starting module: " + this.name);
        this.stocks = [];
        this.loaded = false;
        this.error = null;

        // Request data
        this.getData();

        // Set interval for updates
        const self = this;
        setInterval(function () {
            self.getData();
        }, this.config.updateInterval);
    },

    getData: function () {
        this.sendSocketNotification("GET_TICKER_DATA", {
            symbols: this.config.symbols,
            pushover: {
                enabled: this.config.enablePushover,
                thresholdDrop: this.config.pushoverThresholdDrop,
                thresholdRise: this.config.pushoverThresholdRise,
                token: this.config.pushoverApiToken,
                user: this.config.pushoverUserKey
            }
        });
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "TICKER_DATA_UPDATED") {
            this.stocks = payload;
            this.loaded = true;
            this.error = null;
            this.updateDom();
        }
    },

    getStyles: function () {
        return ["MMM-Ticker.css"];
    },

    formatPrice: function (price, currency) {
        if (price === null || price === undefined) return "---";
        const symbol = this.config.currencySymbols[currency] || (currency + " ");
        const formattedVal = price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (currency === "EUR") {
            return `${formattedVal} ${symbol}`;
        } else {
            return `${symbol}${formattedVal}`;
        }
    },

    formatChange: function (change, changePercent) {
        if (change === null || change === undefined) return "";
        let result = "";

        if (this.config.showChangeValue) {
            const sign = change > 0 ? "+" : "";
            result += `${sign}${change.toFixed(2)}`;
        }

        if (this.config.showChangePercent) {
            if (result !== "") result += " ";
            const sign = changePercent > 0 ? "+" : "";
            result += `(${sign}${changePercent.toFixed(2)}%)`;
        }

        return result;
    },

    getDisplayName: function (stock) {
        const symbol = stock.symbol;
        if (this.config.customNames[symbol]) {
            return this.config.customNames[symbol];
        }

        if (this.config.showName && stock.name) {
            return stock.name;
        }

        if (this.config.stripSuffix && symbol.includes(".")) {
            // Strip suffix like .DE, .F etc.
            return symbol.split(".")[0];
        }

        // Clean up indices name e.g. ^GDAXI -> DAX
        if (symbol === "^GDAXI") return "DAX";
        if (symbol === "^DJI") return "Dow Jones";
        if (symbol === "^IXIC") return "Nasdaq";
        if (symbol === "^SPC") return "S&P 500";

        return symbol;
    },

    createStockElement: function (stock) {
        const stockEl = document.createElement("div");
        stockEl.className = "stock-item";

        // Display Name / Symbol
        const nameEl = document.createElement("span");
        nameEl.className = "stock-name";
        nameEl.innerText = this.getDisplayName(stock);
        stockEl.appendChild(nameEl);

        if (stock.success) {
            // Price
            if (this.config.showPrice) {
                const priceEl = document.createElement("span");
                priceEl.className = "stock-price";
                priceEl.innerText = this.formatPrice(stock.price, stock.currency);
                stockEl.appendChild(priceEl);
            }

            // Change
            const change = stock.change;
            const changePercent = stock.changePercent;

            const changeEl = document.createElement("span");
            changeEl.className = "stock-change";

            if (this.config.colored) {
                if (change > 0) {
                    changeEl.classList.add("pos");
                } else if (change < 0) {
                    changeEl.classList.add("neg");
                }
            }

            const arrow = change > 0 ? "▲" : (change < 0 ? "▼" : "•");
            changeEl.innerText = `${arrow} ${this.formatChange(change, changePercent)}`;
            stockEl.appendChild(changeEl);
        } else {
            const errorEl = document.createElement("span");
            errorEl.className = "stock-error";
            errorEl.innerText = "Error";
            stockEl.appendChild(errorEl);
        }

        return stockEl;
    },

    calculatePortfolio: function () {
        let totalValue = 0;
        let totalChange = 0;
        let totalPrevValue = 0;
        let hasPortfolio = false;

        this.config.symbols.forEach(s => {
            const isObject = typeof s === "object" && s.symbol && s.shares !== undefined;
            const sym = isObject ? s.symbol : s;
            const shares = isObject ? s.shares : 0;

            if (shares > 0) {
                hasPortfolio = true;
                const stock = this.stocks.find(st => st.symbol === sym);
                if (stock && stock.success && stock.price !== null) {
                    const price = stock.price;
                    const change = stock.change !== null ? stock.change : 0;
                    const prevClose = price - change;

                    totalValue += price * shares;
                    totalPrevValue += prevClose * shares;
                }
            }
        });

        if (!hasPortfolio) {
            // Unweighted average daily return
            const validStocks = this.stocks.filter(st => st.success && st.changePercent !== null);
            if (validStocks.length === 0) return null;
            const avgChangePercent = validStocks.reduce((sum, st) => sum + st.changePercent, 0) / validStocks.length;
            return {
                isPortfolio: false,
                changePercent: avgChangePercent
            };
        }

        totalChange = totalValue - totalPrevValue;
        const totalChangePercent = totalPrevValue !== 0 ? (totalChange / totalPrevValue) * 100 : 0;

        return {
            isPortfolio: true,
            totalValue: totalValue,
            change: totalChange,
            changePercent: totalChangePercent
        };
    },

    getDom: function () {
        const wrapper = document.createElement("div");
        wrapper.className = "mmm-ticker-container";

        if (!this.loaded) {
            wrapper.innerHTML = "<div class='loading'>Loading stock ticker...</div>";
            return wrapper;
        }

        if (this.stocks.length === 0) {
            wrapper.innerHTML = "<div class='no-data'>No stocks configured.</div>";
            return wrapper;
        }

        const sentiment = this.calculatePortfolio();

        if (this.config.mode === "table") {
            wrapper.classList.add("table-mode");
            wrapper.style.setProperty("--columns", this.config.columns);

            this.stocks.forEach(stock => {
                const item = this.createStockElement(stock);
                wrapper.appendChild(item);
            });
        } else {
            // Default: Ticker Mode
            wrapper.classList.add("ticker-mode");

            const marqueeWrapper = document.createElement("div");
            marqueeWrapper.className = "mmm-ticker-marquee-wrapper";

            const marqueeInner = document.createElement("div");
            marqueeInner.className = "mmm-ticker-marquee-inner";

            // Set speed class
            marqueeInner.classList.add(`speed-${this.config.speed}`);

            // To make marquee loop seamlessly without gaps:
            // Render the elements twice.
            const renderGroup = () => {
                const group = document.createElement("div");
                group.className = "mmm-ticker-group";

                this.stocks.forEach(stock => {
                    const item = this.createStockElement(stock);
                    group.appendChild(item);
                });
                return group;
            };

            // Append two identical groups
            marqueeInner.appendChild(renderGroup());
            marqueeInner.appendChild(renderGroup());

            marqueeWrapper.appendChild(marqueeInner);
            wrapper.appendChild(marqueeWrapper);
        }

        return wrapper;
    }
});
