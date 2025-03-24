"use client";

import { useState, useEffect } from "react";

import ExampleGrid from "./components/exgrid";
import ChartExample from "./components/exchart";
import useCommandK from "./hooks/useK";
import StockChart from "./components/stockchart";

import StockModule from "./components/stockmodule";
import UpdateModule from "./components/updatemodule";

interface Stocks {
  ticker: string;
  open: number;
  drift: number;
  volatility: number;
}


export default function Home() {

  const [isPressed, setIsPressed] = useCommandK();
  const [updateCount, setUpdateCount] = useState(0);
  const [stockToUpdate, setStockToUpdate] = useState<Stocks | null>(null);
  const [stocks, setStocks] = useState<Stocks[]>([]);
  const [selectedTickers, setSelectedTickers] = useState<string[]>([]);

  const handleTickerSelection = (newTicker: string) => {
    setSelectedTickers((prevTickers) => {
      if (!prevTickers.includes(newTicker)) {
        return [...prevTickers, newTicker]; // Add the new ticker
      }
      return prevTickers; // Return the previous state if the ticker already exists
    });
    
  };

  useEffect(() => {
    updateStocks(selectedTickers);
  }, [selectedTickers, updateCount]); 

  const removeTicker = (tickerToRemove: string) => {
    setSelectedTickers((prevTickers) =>
      prevTickers.filter((ticker) => ticker !== tickerToRemove)
    );
  };

  function updateStocks(tickers: string[]) {
    const fetchData = async () => {
      try {
        const stocksUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/stocks/parameters` : 'http://localhost:8080/api/v1/stocks/parameters';
        console.log(stocksUrl)
        console.log(JSON.stringify({ tickers: tickers }))
        const response = await fetch(stocksUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json', 
          },
          body: JSON.stringify({ tickers: tickers }), // Convert tickers to JSON
        } );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log(data)
        setStocks(data["stocks"]);
      } catch (error) {
        console.log(error)
      }
    };
    fetchData()
  }

  function setStocksParameters(ticker: string, drift: number, volatility: number) {
    const configureParameters = async () => {
      try {
        const stocksUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/stocks/parameters` : 'http://localhost:8080/api/v1/stocks/parameters';

        const response = await fetch(stocksUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json', 
          },
          body: JSON.stringify({ ticker: ticker, drift: drift, volatility: volatility }),
        } );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        setUpdateCount((prevCount) => prevCount + 1);
      } catch (error) {
        console.log(error)
      }
      setStockToUpdate(null)
    };
    configureParameters()
  }

 

  function updateTicker(ticker: string, volatility: number, drift: number) {
    const newStock: Stocks = {ticker: ticker, open: 0, drift: drift, volatility: volatility};
    setStockToUpdate(newStock)
  }

  return (
    <main className="flex flex-row h-full w-full">
      {isPressed && <StockModule selectedTickers={selectedTickers} handleTickerSelection={handleTickerSelection}/>}
      {(stockToUpdate !== null) && <UpdateModule selectedTicker={stockToUpdate} setStocksParameters={setStocksParameters}/>}
      
      <section className="h-full w-2xl border-r border-neutral-300 shadow p-6 flex flex-col gap-6">
        <button onClick={() => setIsPressed(true)} className="flex flex-row items-center justify-between text-neutral-500 text-lg border border-neutral-300 rounded-lg w-full py-2 px-4 hover:cursor-pointer">
          <p>Add ticker</p>
          <div>&#8984; K </div>
        </button>
        {/* <p>Selected Tickers: {selectedTickers.join(", ")}</p>
        <p>Stocks: {stocks.map((stock) => stock.ticker + " - " + stock.volatility + ", " + stock.drift).join(", ")}</p> */}
        <ExampleGrid stocks={stocks} removeTicker={removeTicker} updateTicker={updateTicker}/>
      </section>
      <section className="w-full h-full p-6 flex flex-row items-center justify-center">
        <StockChart tickers={selectedTickers}/>
      </section>
    </main>
  );
}


