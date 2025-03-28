"use client";

import { useState, useEffect } from "react";
import { GrFormClose } from "react-icons/gr";

interface Stock {
    ticker: string;
    open: number;
    drift: number;
    volatility: number;
  }

interface StockModuleProps {
    selectedTicker: Stock;
    setStocksParameters: (ticker: string, drift: number, volatility: number) => void;
    setStockToUpdate: React.Dispatch<React.SetStateAction<Stock | null>>;
}

export default function StockModule({  selectedTicker, setStocksParameters, setStockToUpdate }: StockModuleProps) {

    const [newVolatility, setNewVolatility] = useState<number>(selectedTicker.volatility);
    const [newDrift, setNewDrift] = useState<number>(selectedTicker.drift);


    return (
        <div className="fixed w-full h-full bg-bmo-blue/30 flex flex-row pt-16 justify-center z-20" onClick={() => setStockToUpdate(null)}>
            <div className="relative bg-neutral-100 w-2xl h-80 rounded-xl p-6 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}  >
                <GrFormClose className="cursor-pointer text-xl size-8 absolute top-4 right-4 text-red-700 hover:text-red-500 druration-150" onClick={() => setStockToUpdate(null)}/>
                <h1 className="text-xl font-bold">Edit Parameters for 
                    <span className="text-bmo-blue">&#32; {selectedTicker.ticker}</span>
                </h1>
                <div className="flex flex-col gap-2">
                    <input className="w-full h-12 p-2 rounded-md border border-neutral-300" type="text" placeholder="Volatility" onChange={(e) => setNewVolatility(parseFloat(e.target.value))}/>
                    <input className="w-full h-12 p-2 rounded-md border border-neutral-300" type="text" placeholder="Drift" onChange={(e) => setNewDrift(parseFloat(e.target.value))}/>
                </div>
                <button className="rounded-lg mt-auto p-2 cursor-pointer border border-bmo-blue hover:shadow-sm hover:border-2 hover:font-bold duration-150" onClick={() => setStocksParameters(selectedTicker.ticker, newDrift, newVolatility)}>Update Ticker</button>
            </div>
        </div>
    );
}

