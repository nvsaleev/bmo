"use client";

import { useState, useEffect } from "react";
import { GrFormClose } from "react-icons/gr";
import { Stock } from "../types";

import { fetchAllTickers } from "../api/pricing";

interface StockModuleProps {
    selectedStocks: Stock[];
    handleStockSelection: (tickerToAdd: string) => void;
    setIsPressed: React.Dispatch<React.SetStateAction<boolean>>
}

export default function StockSearchModule({ selectedStocks, handleStockSelection: handleTickerSelection, setIsPressed }: StockModuleProps) {

    const [tickers, setTickers] = useState<string[]>([]); 
    const [searchedTicker, setSearchedTicker] = useState("");
   
    // Fetch available tickers from the backend
    useEffect(() => {
        const fetchTickers = async () => setTickers(await fetchAllTickers());
        fetchTickers();
    }, []); // Empty dependency array ensures this runs only once on mount
    
    function onTickerSelection(ticker: string) {
      handleTickerSelection(ticker);
      setTickers((prevTickers) => prevTickers.filter((t) => t !== ticker));
    }

    return (
        <div onClick={() => setIsPressed(false)} className="fixed w-full h-full bg-bmo-blue/30 flex flex-row pt-16 justify-center z-20">
            <div className="relative bg-neutral-100 w-2xl h-80 rounded-xl p-6 flex flex-col gap-4"  onClick={(e) => e.stopPropagation()} >
                <GrFormClose className="cursor-pointer size-8 absolute top-4 right-4 text-red-700 hover:text-red-500 duration-150" onClick={() => setIsPressed(false)}/>
                <h1 className="text-xl font-bold">Add Ticker</h1>
                <input className="w-full h-12 p-2 rounded-md border border-neutral-300" type="text" placeholder="Search ticker..." onChange={(e) => setSearchedTicker(e.target.value)}/>
                <h2 className="font-bold">Available Tickers:</h2>
                <ul className="flex flex-col gap-2">
                  {selectMatchingPrefix(tickers, searchedTicker, selectedStocks).map((ticker) => <li onClick={() => onTickerSelection(ticker)} key={ticker} className="rounded-lg hover:bg-neutral-200 p-2 hover:cursor-pointer">{ticker}</li>)}
                </ul>
            </div>
        </div>
    );
}


function selectMatchingPrefix(strings: string[], prefix: string, selectedStocks: Stock[], n: number=3): string[] {
    
    if (!strings || n <= 1) {
      return [];
    }

    const selectedTickers = selectedStocks.length > 0 ? selectedStocks.map((stock) => stock.ticker) : [];

    if (!prefix) {
        return strings.filter((str) => !selectedTickers.includes(str)).slice(0, Math.min(n, strings.length));
    }
    
    const lowerPrefix = prefix.toLowerCase()
    const matchingStrings: string[] = [];
    let count = 0;
  
    for (const str of strings) {
      if (str.toLowerCase().startsWith(lowerPrefix) && !selectedTickers.includes(str)) {
        matchingStrings.push(str);
        count++;
        if (count >= n) {
          break;
        }
      }
    }
  
    return matchingStrings;
  }
  