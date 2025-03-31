"use client";

import { useState } from "react";

import useCommandK from "./hooks/useCommandK";

import SearchBar from "./components/SearchBar";
import StockGrid from "./components/StockGrid";
import StockChart from "./components/StockChart";
import StockSearchModule from "./components/StockSearchModule";
import ParameterUpdateModule from "./components/ParameterUpdateModule";

import { Stock } from "./types";
import { fetchStockParameters, updateTickerParameters } from "./pricingAPI";

export default function Home() {

  const [isPressed, setIsPressed] = useCommandK();
  const [selectedStocks, setSelectedStocks] = useState<Stock[]>([]);
  const [stockToUpdate, setStockToUpdate] = useState<Stock | null>(null);


  function removeStock(tickerToRemove: string) {
    setSelectedStocks((prevSelectedStocks) =>
      prevSelectedStocks.filter((s) => s.ticker !== tickerToRemove)
    );
  };

  function addStock(tickerToAdd: string) {
    async function updateSelectedStocks() {
      const newStocks = await fetchStockParameters([tickerToAdd, ]);
      if (newStocks.length !== 1) {
        throw new Error("Cannot add a stock");
      }
      setSelectedStocks((prevSelectedStocks) => [...prevSelectedStocks, newStocks[0]]);
    }
    updateSelectedStocks();
  };

  function updateAllStocks() {
    async function updateSelectedStocks() {
      const tickers = selectedStocks.map((stock) => stock.ticker);
      const newStocks = await fetchStockParameters(tickers);
      setSelectedStocks(newStocks);
    
    }
    updateSelectedStocks();
  }

  function updateStockParameters(ticker: string, newDrift: number,newVolatility: number) {
    async function configureParameters() {
      await updateTickerParameters(ticker, newDrift, newVolatility);
      setStockToUpdate(null);
      updateAllStocks();
    };
    configureParameters();
  }


  return (
    <main className="flex flex-row h-full w-full">
      <section className="h-full w-2xl border-r border-neutral-300 shadow p-6 flex flex-col gap-6">
        <SearchBar setIsPressed={setIsPressed} />
        <StockGrid
          selectedStocks={selectedStocks}
          removeStock={removeStock}
          setStockToUpdate={setStockToUpdate}
        />
      </section>
      <section className="w-full h-full p-6 flex flex-row items-center justify-center">
        <StockChart selectedStocks={selectedStocks} />
      </section>

      {/* Display modules if needed */}
      {isPressed && (
        <StockSearchModule
          selectedStocks={selectedStocks}
          handleStockSelection={addStock}
          setIsPressed={setIsPressed}
        />
      )}

      {stockToUpdate !== null && (
        <ParameterUpdateModule
          setStockToUpdate={setStockToUpdate}
          stockToUpdate={stockToUpdate}
          updateStockParameters={updateStockParameters}
        />
      )}

    </main>
  );
}