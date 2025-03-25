"use client";

import { useState, useEffect } from "react";
import { GrFormClose } from "react-icons/gr";

interface StockModuleProps {
    selectedTickers: string[];
    setIsPressed: React.Dispatch<React.SetStateAction<boolean>>;
    handleTickerSelection: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function StockModule({ selectedTickers, handleTickerSelection, setIsPressed }: StockModuleProps) {

    const [tickers, setTickers] = useState<string[]>([]); //"GOOG", "AAPL", "MSFT", "TSLA", "AMZN", "FB", "NFLX",
    const [searchedTicker, setSearchedTicker] = useState("");



    useEffect(() => {
        const fetchData = async () => {
          try {
            const stocksUrl = process.env.BFF_HOST ? `${process.env.BFF_HOST}/api/v1/stocks` : 'http://localhost:8080/api/v1/stocks';
            console.log(stocksUrl)
 
            const response = await fetch(stocksUrl);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            console.log(data)
            setTickers(data["tickers"]);
          } catch (error) {
            console.log(error)
          }
        };
    
        fetchData(); // Call the async function
    }, []); // Empty dependency array ensures this runs only once on mount

    
    

    return (
        <div className="fixed w-full h-full bg-bmo-blue/30 flex flex-row pt-16 justify-center z-20">
            <div className="relative bg-neutral-100 w-2xl h-80 rounded-xl p-6 flex flex-col gap-4"  >
                <GrFormClose className="cursor-pointer size-8 absolute top-4 right-4 text-red-700 hover:scale-100" onClick={() => setIsPressed(false)}/>
                <h1 className="text-xl font-bold">Add Ticker</h1>
                <input className="w-full h-12 p-2 rounded-md border border-neutral-300" type="text" placeholder="Ticker" onChange={(e) => setSearchedTicker(e.target.value)}/>
                <h2 className="font-bold">Available Tickers:</h2>
                <ul className="flex flex-col gap-2">
                    {selectMatchingPrefix(tickers, searchedTicker, selectedTickers).map((ticker) => <li onClick={() => handleTickerSelection(ticker)} key={ticker} className="rounded-lg hover:bg-neutral-200 p-2">{ticker}</li>)}
                </ul>
            </div>
        </div>
    );
}


function selectMatchingPrefix(strings: string[], prefix: string, selectedTickers: string[], n: number=3): string[] {
    
    if (!strings || n <= 1) {
      return [];
    }

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
  