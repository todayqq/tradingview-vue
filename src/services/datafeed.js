import { generateSymbol, makeBinanceRequest, parseFullSymbol, priceScale } from './helpers';
import SocketClient, { BINANCE_RESOLUSION } from './streaming';

const configurationData = {
    supported_resolutions: [
        "1", "3", "5", "15", "30", "1H", "2H", "4H", "6H", "8H", "12H", "1D", "3D", "1W", "1M"
    ],
    exchanges: [{ value: "Binance", name: "Binance", desc: "Binance" }],
    symbols_types: [{ name: "crypto", value: "crypto" }],
};

export default class BinanceDataFeed {
    constructor(options = {}) {
        this.options = options;
        this.lastBarsCache = new Map();
        this.socket = new SocketClient();
        if (!options.DatafeedConfiguration) {
            this.options.DatafeedConfiguration = configurationData;
        }
    }

    async onReady(callback) {
        console.log("[onReady]: Method call");
        setTimeout(() => callback(configurationData));
    }

    async searchSymbols(userInput, exchange, symbolType, onResultReadyCallback) {
        console.log("[searchSymbols]: Method call");
        const symbols = await this.getAllSymbols();
        const newSymbols = symbols.filter((symbol) => {
            const isExchangeValid = exchange === "" || symbol.exchange === exchange;
            const isFullSymbolContainsInput = symbol.full_name.toLowerCase().includes(userInput.toLowerCase());
            return isExchangeValid && isFullSymbolContainsInput;
        });
        onResultReadyCallback(newSymbols);
    }

    async getAllSymbols() {
        const data = await makeBinanceRequest("api/v3/exchangeInfo");
        let allSymbols = [];

        for (const exchange of configurationData.exchanges) {
            const pairs = data.symbols;

            for (const pair of pairs) {
                const symbolInfo = generateSymbol(exchange.value, pair.baseAsset, pair.quoteAsset);
                const symbol = {
                    symbol: symbolInfo.short,
                    full_name: symbolInfo.full,
                    description: symbolInfo.short,
                    exchange: exchange.value,
                    type: "crypto",
                    tickSize: pair.filters[0].tickSize,
                };
                allSymbols.push(symbol);
            }
        }

        return allSymbols;
    }

    async resolveSymbol(symbolName, onSymbolResolvedCallback, onResolveErrorCallback) {
        const symbols = await this.getAllSymbols();
        const symbolItem = symbols.find(({ symbol }) => symbol === symbolName);

        if (!symbolItem) {
            console.log("[resolveSymbol]: Cannot resolve symbol", symbolName);
            onResolveErrorCallback("Cannot resolve symbol");
            return;
        }

        const symbolInfo = {
            ticker: symbolItem.full_name,
            name: symbolItem.symbol,
            description: symbolItem.description,
            type: symbolItem.type,
            session: "24x7",
            timezone: "Etc/UTC",
            exchange: symbolItem.exchange,
            minmov: 1,
            pricescale: priceScale(symbolItem.tickSize),
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: false,
            visible_plots_set: "ohlcv",
            supported_resolutions: configurationData.supported_resolutions,
            volume_precision: 2,
            data_status: "streaming",
        };

        console.log("[resolveSymbol]: Symbol resolved", symbolName);
        onSymbolResolvedCallback(symbolInfo);
    }

    async getBars(symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) {
        const { from, to, firstDataRequest } = periodParams;
        if (symbolInfo) {
            const symbol = symbolInfo.name.replace('/', '');
            const urlParameters = {
                symbol: symbol,
                interval: BINANCE_RESOLUSION[resolution],
                endTime: to * 1000,
                limit: 1000,
            };

            const query = Object.keys(urlParameters)
                .map((name) => `${name}=${encodeURIComponent(urlParameters[name])}`)
                .join("&");

            try {
                const data = await makeBinanceRequest(`api/v3/klines?${query}`);

                if (!data || data.length === 0) {
                    onHistoryCallback([], { noData: true });
                    return;
                }

                let bars = [];
                data.forEach((bar) => {
                    if (parseInt(bar[0]) >= from * 1000 && parseInt(bar[0]) < to * 1000) {
                        bars.push({
                            time: parseInt(bar[0]),
                            open: parseFloat(bar[1]),
                            high: parseFloat(bar[2]),
                            low: parseFloat(bar[3]),
                            close: parseFloat(bar[4]),
                            volume: parseFloat(bar[5]),
                        });
                    }
                });

                if (firstDataRequest) {
                    this.lastBarsCache.set(symbolInfo.name, bars[bars.length - 1]);
                }

                console.log(`[getBars]: returned ${bars.length} bar(s)`);
                onHistoryCallback(bars, { noData: false });
            } catch (error) {
                console.log("[getBars]: Get error", error);
                onErrorCallback(error);
            }
        }
    }

    subscribeBars(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback) {
        console.log("[subscribeBars]: Method call with subscriberUID:", subscriberUID);
        this.socket.subscribeOnStream(
            symbolInfo,
            resolution,
            onRealtimeCallback,
            subscriberUID,
            onResetCacheNeededCallback,
            this.lastBarsCache.get(symbolInfo.name)
        );
    }

    unsubscribeBars(subscriberUID) {
        console.log("[unsubscribeBars]: Method call with subscriberUID:", subscriberUID);
        this.socket.unsubscribeFromStream(subscriberUID);
    }
}
