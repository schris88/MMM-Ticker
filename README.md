# MMM-Ticker

A high-performance, modern, and absolutely stutter-free stock market ticker module for [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror).

Unlike traditional ticker modules that cause significant Raspberry Pi CPU spikes and layout lag, `MMM-Ticker` is built for maximum performance:
1. **Compositor-Bound Marquee (`mode: "ticker"`)**: Uses hardware-accelerated CSS `translate3d` transforms and `will-change: transform`. This ensures all scrolling is rendered on the GPU compositor thread at 60 FPS, leaving the CPU completely free.
2. **Compact Multi-Column Table (`mode: "table"`)**: Distributes stock symbols across multiple columns instead of stretching them vertically.
3. **Smart Background Updates**: A dedicated server-side Node helper fetches quotes from Yahoo Finance asynchronously and supports caching to prevent API rate-limiting or offline errors.

---

## Installation

Since the module is self-contained in your `modules/` directory and requires no external node libraries or python scripts:

1. Copy the `MMM-Ticker` folder to your `modules` directory:
   ```bash
   cd ~/MagicMirror/modules/
   # (If downloading from repository) git clone https://github.com/christianstengel/MMM-Ticker.git
   ```
2. Add the configuration snippet to `config/config.js` (see below).

---

## Configuration Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `symbols` | `Array` | `["AAPL", "MSFT", "TSLA", "SAP.DE", "ALV.DE", "^GDAXI"]` | List of stock symbols to fetch. Supports indices (e.g. `^GDAXI`, `^DJI`) and currencies (e.g. `EURUSD=X`). |
| `mode` | `String` | `"ticker"` | Layout mode: `"ticker"` (horizontal marquee) or `"table"` (static grid table). |
| `columns` | `Number` | `3` | Number of columns to show if `mode` is set to `"table"`. |
| `updateInterval` | `Number` | `600000` (10m) | Time interval in milliseconds to fetch price updates. |
| `speed` | `String` | `"medium"` | Marquee scroll speed: `"slow"` (60s), `"medium"` (30s), or `"fast"` (15s). |
| `showChangePercent` | `Boolean` | `true` | Show percentage price change. |
| `showChangeValue` | `Boolean` | `true` | Show absolute change value. |
| `showSymbol` | `Boolean` | `true` | Show the stock symbol. |
| `showName` | `Boolean` | `false` | Show the full stock company name instead of the symbol. |
| `stripSuffix` | `Boolean` | `true` | Hide regional suffixes from symbols (e.g., `SAP.DE` renders as `SAP`). |
| `colored` | `Boolean` | `true` | Show positive changes in green and negative in red. |
| `customNames` | `Object` | `{}` | Key-value pairs of aliases/custom names (e.g. `{"^GDAXI": "DAX", "ALV.DE": "Allianz"}`). |
| `currencySymbols` | `Object` | `{"USD": "$", "EUR": "€", ...}` | Key-value pairs mapping currency codes to symbols (defaults are `USD`, `EUR`, `GBP`, `JPY`, `CHF`). |
| `enablePushover` | `Boolean` | `false` | Enables sending push notifications via Pushover when price alert thresholds are crossed. |
| `pushoverThresholdDrop` | `Number` | `5` | The 2-day drop threshold (in percent) that triggers a Pushover alert. |
| `pushoverThresholdRise` | `Number` | `null` | The 2-day rise threshold (in percent) that triggers a Pushover alert. Set to `null` to disable. |
| `pushoverApiToken` | `String` | `""` | Pushover Application API Token. |
| `pushoverUserKey` | `String` | `""` | Pushover User Key. |

---

## Portfolio Tracking

The module also supports basic portfolio tracking. Instead of specifying stock symbols as plain strings in the `symbols` array, you can define them as objects containing a `shares` property:

```javascript
symbols: [
    { symbol: "AAPL", shares: 10 },
    { symbol: "MSFT", shares: 5 },
    "TSLA" // Plain strings are still supported
]
```

When you define shares for stocks, the module calculates the portfolio's total value, net change, and percentage change internally.

---

## Pushover Alerts

The module supports sending push notifications via [Pushover](https://pushover.net/) when a stock experiences a significant price movement over a 2-day period.

To enable Pushover alerts, configure the following settings in your `config.js`:

```javascript
enablePushover: true,
pushoverApiToken: "YOUR_PUSHOVER_APP_TOKEN",
pushoverUserKey: "YOUR_PUSHOVER_USER_KEY",
pushoverThresholdDrop: 5, // Alert if stock drops 5% or more over 2 days
pushoverThresholdRise: 10, // Alert if stock rises 10% or more over 2 days
```

### How it works:
1. **2-Day Change Tracking**: The module fetches Yahoo Finance 2-day chart data. It calculates the percentage change between the current market price and the price from 2 days ago.
2. **Alert Frequency Limiting**: To prevent notification spam, the module caches sent alerts in a local file (`sent_alerts.json`) and will only send one drop alert and one rise alert per stock symbol per day.

---

## Configuration Example

Here is a full configuration example for `config/config.js`:

```javascript
{
    module: "MMM-Ticker",
    position: "top_bar", // Ideal for ticker mode. Use top_left or top_right for table mode.
    config: {
        symbols: [
            { symbol: "AAPL", shares: 10 },
            { symbol: "MSFT", shares: 5 },
            "TSLA",
            "SAP.DE",
            "MBG.DE",
            "ALV.DE",
            "^GDAXI"
        ],
        mode: "ticker",
        speed: "medium",
        updateInterval: 15 * 60 * 1000, // 15 minutes
        customNames: {
            "SAP.DE": "SAP",
            "MBG.DE": "Mercedes-Benz",
            "ALV.DE": "Allianz",
            "^GDAXI": "DAX"
        }
    }
}
```

