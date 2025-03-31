import { Stock, StockPriceHistory, FeedData } from "./types";

export async function fetchStockParameters(tickers: string[]): Promise<Stock[]> {

    const stocksUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/stocks` : "http://localhost:8080/api/v1/stocks";
    const response = await fetch(stocksUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ tickers: tickers }), // Convert tickers to JSON
    });
  
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  
    const data = await response.json();
  
    return data["stocks"];
  }
  
export async function updateTickerParameters(ticker: string, newDrift: number, newVolatility: number) {
    const stocksUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/stocks` : "http://localhost:8080/api/v1/stocks";
    const response = await fetch(stocksUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ticker: ticker,
        drift: newDrift,
        volatility: newVolatility,
      }),
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  }


export async function fetchAllTickers(): Promise<string[]> {

  const stocksUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/tickers` : 'http://localhost:8080/api/v1/tickers';
  const response = await fetch(stocksUrl);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data["tickers"];

};

export async function getFeed(tickers: string[]): Promise<FeedData> {
  
  const feedUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/stocks/feed` : "http://localhost:8080/api/v1/stocks/feed";
  const response = await fetch(feedUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tickers }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data: FeedData = await response.json();
  return data;
};

export async function getPriceHistory(tickers: string[]): Promise<StockPriceHistory> {
  
  const stocksUrl = process.env.BFF_HOST? `${process.env.BFF_HOST}/api/v1/stocks/history`: "http://localhost:8080/api/v1/stocks/history";
  const response = await fetch(stocksUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tickers }),
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data: StockPriceHistory = await response.json();
  return data;
};