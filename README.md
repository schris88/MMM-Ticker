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

---

## Configuration Example

Here is a full configuration example for `config/config.js`:

```javascript
{
    module: "MMM-Ticker",
    position: "top_bar", // Ideal for ticker mode. Use top_left or top_right for table mode.
    config: {
        symbols: ["AAPL", "MSFT", "TSLA", "SAP.DE", "MBG.DE", "ALV.DE", "^GDAXI"],
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
