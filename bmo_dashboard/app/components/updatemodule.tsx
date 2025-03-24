"use client";

import { useState, useEffect } from "react";

interface Stock {
    ticker: string;
    open: number;
    drift: number;
    volatility: number;
  }

interface StockModuleProps {
    selectedTicker: Stock;
    setStocksParameters: (ticker: string, drift: number, volatility: number) => void;
}

export default function StockModule({  selectedTicker, setStocksParameters }: StockModuleProps) {

    const [newVolatility, setNewVolatility] = useState<number>(selectedTicker.volatility);
    const [newDrift, setNewDrift] = useState<number>(selectedTicker.drift);


    return (
        <div className="fixed w-full h-full bg-bmo-blue/30 flex flex-row pt-16 justify-center z-20">
            <div className="bg-neutral-100 w-2xl h-80 rounded-xl p-6 flex flex-col gap-4"  >
                <h1 className="text-xl font-bold">Edit Parameters for {selectedTicker.ticker}</h1>
                <div className="flex flex-col gap-2">
                    <input className="w-full h-12 p-2 rounded-md border border-neutral-300" type="text" placeholder="Volatility" onChange={(e) => setNewVolatility(parseFloat(e.target.value))}/>
                    <input className="w-full h-12 p-2 rounded-md border border-neutral-300" type="text" placeholder="Drift" onChange={(e) => setNewDrift(parseFloat(e.target.value))}/>
                </div>
                <button className="rounded-lg p-2 cursor-pointer border border-bmo-blue" onClick={() => setStocksParameters(selectedTicker.ticker, newDrift, newVolatility)}>Update Ticker</button>
                
            </div>
        </div>
    );
}

