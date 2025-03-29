export interface Stock {
    ticker: string;
    open: number;
    drift: number;
    volatility: number;
}

export interface StockFeed {
    feed: {
        ticker: string;
        price: number;
        timestamp: string;
    }[];
}

type StockPrices = {
    ticker: string;
    prices: number[];
}

type StockPrice = {
    ticker: string;
    price: number;
    timestamp: string;
}

export interface StockPriceHistory {
    timestamp: string[];
    price_history: StockPrices[];
}

export interface FeedData {
    feed: StockPrice[];
}