export const BINANCE_RESOLUSION = {
    1: "1m",
    3: "3m",
    5: "5m",
    15: "15m",
    30: "30m",
    60: "1h",
    120: "2h",
    240: "4h",
    360: "6h",
    480: "8h",
    720: "12h",
    "1D": "1d",
    "2D": "2d",
    "3D": "3d",
    "1W": "1w",
    "1M": "1M",
};

export default class SocketClient {
    constructor() {
        console.log("[SocketClient] init");
        this.socket = null;
        this.channelToSubscription = new Map();
        this._createSocket();
    }

    _createSocket() {
        this.socket = new WebSocket("wss://data-stream.binance.vision/ws");

        this.socket.addEventListener("open", () => {
            console.log("[socket] Connected");
        });

        this.socket.addEventListener("close", (event) => {
            console.log("[socket] Disconnected:", event.reason);
        });

        this.socket.addEventListener("error", (error) => {
            console.log("[socket] Error:", error);
        });

        this.socket.addEventListener("message", ({ data }) => {
            const { E: time, k: kline } = JSON.parse(data);

            if (!kline) {
                return;
            }

            const tradePrice = parseFloat(kline.c);
            const tradeTime = parseInt(time);

            const channelString = `${kline.s.toLowerCase()}@kline_${kline.i}`;
            const subscriptionItem = this.channelToSubscription.get(channelString);

            if (subscriptionItem === undefined) {
                return;
            }

            const lastDailyBar = subscriptionItem.lastDailyBar;

            let bar;
            if (tradeTime > kline.T) {
                bar = {
                    time: kline.T+1,
                    open: tradePrice,
                    high: tradePrice,
                    low: tradePrice,
                    close: tradePrice,
                };
                console.log("[socket] Generate new bar", bar);
            } else {
                bar = {
                    ...lastDailyBar,
                    high: Math.max(lastDailyBar.high, tradePrice),
                    low: Math.min(lastDailyBar.low, tradePrice),
                    close: tradePrice,
                };
            }

            subscriptionItem.lastDailyBar = bar;
            subscriptionItem.handlers.forEach((handler) => handler.callback(bar));
        });
    }

    subscribeOnStream(symbolInfo, resolution, onRealtimeCallback, subscriberUID, onResetCacheNeededCallback, lastDailyBar) {
        if (symbolInfo) {
            const symbol = symbolInfo.name.replace('/', '');
            const channelString = `${symbol.toLowerCase()}@kline_${BINANCE_RESOLUSION[resolution]}`;

            const handler = {
                id: subscriberUID,
                callback: onRealtimeCallback,
            };

            let subscriptionItem = this.channelToSubscription.get(channelString);
            if (subscriptionItem) {
                subscriptionItem.handlers.push(handler);
                return;
            }

            subscriptionItem = {
                subscriberUID,
                resolution,
                lastDailyBar,
                handlers: [handler],
            };

            this.channelToSubscription.set(channelString, subscriptionItem);
            console.log("[subscribeBars]: Subscribe to streaming. Channel:", channelString);

            this.emit("SUBSCRIBE", [channelString], 1);
        }
    }

    unsubscribeFromStream(subscriberUID) {
        for (const channelString of this.channelToSubscription.keys()) {
            const subscriptionItem = this.channelToSubscription.get(channelString);
            const handlerIndex = subscriptionItem.handlers.findIndex((handler) => handler.id === subscriberUID);

            if (handlerIndex !== -1) {
                subscriptionItem.handlers.splice(handlerIndex, 1);

                if (subscriptionItem.handlers.length === 0) {
                    console.log("[unsubscribeBars]: Unsubscribe from streaming. Channel:", channelString);
                    this.emit("UNSUBSCRIBE", [channelString], 2);
                    this.channelToSubscription.delete(channelString);
                    break;
                }
            }
        }
    }

    emit(method, params, id) {
        if (this.socket.readyState !== WebSocket.OPEN) {
            console.log("[socket] Socket is not open, cannot subscribe");
            return;
        }

        this.socket.send(JSON.stringify({ method, params, id }));
    }

    getNextDailyBarTime(barTime) {
        const date = new Date(barTime);
        date.setDate(date.getDate() + 1);
        return date.getTime();
    }
}
