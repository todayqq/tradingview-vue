import fetch from 'node-fetch-with-proxy'; // 如果不需要代理，可以直接使用原生 fetch
const cache = new Map();

/**
 * 通过代理请求 Binance API
 * @param {string} path - API 路径
 * @returns {Promise<any>} - 返回 API 响应数据
 */
export async function makeApiRequest(path) {
    try {
        const response = await fetch(`/api/binance/${path}`);
        return response.json();
    } catch (error) {
        throw new Error(`[Binance] request error: ${error}`);
    }
}

/**
 * 直接请求 Binance API
 * @param {string} path - API 路径
 * @returns {Promise<any>} - 返回 API 响应数据
 */
export async function makeBinanceRequest(path) {
    try {
        if (cache.has(path)) {
            return cache.get(path);
        }

        const response = await fetch(`https://api.binance.com/${path}`);
        const data = await response.json();
        cache.set(path, data);
        return data;
    } catch (error) {
        throw new Error(`[Binance] request error: ${error}`);
    }
}

/**
 * 生成交易对符号
 * @param {string} exchange - 交易所名称
 * @param {string} fromSymbol - 基础货币
 * @param {string} toSymbol - 目标货币
 * @returns {{short: string, full: string}} - 返回简写和完整符号
 */
export function generateSymbol(exchange, fromSymbol, toSymbol) {
    const short = `${fromSymbol}${toSymbol}`;
    return {
        short,
        full: `${exchange}:${short}`,
    };
}

/**
 * 解析完整符号
 * @param {string} fullSymbol - 完整符号（例如：Binance:BTC/USDT）
 * @returns {{exchange: string, symbol: string} | null} - 返回解析后的交易所和交易对
 */
export function parseFullSymbol(fullSymbol) {
    const match = fullSymbol.match(/^(\w+):(\w+)\/(\w+)$/);
    if (!match) {
        return null;
    }
    return { exchange: match[1], symbol: `${match[2]}${match[3]}` };
}

/**
 * 计算价格精度
 * @param {string | number} tickSize - 最小价格变动单位
 * @returns {number} - 返回价格精度
 */
export function priceScale(tickSize) {
    if (Number(tickSize) >= 1) {
        return Math.pow(10, Number(tickSize));
    } else {
        return Math.round(1 / parseFloat(String(tickSize)));
    }
}
