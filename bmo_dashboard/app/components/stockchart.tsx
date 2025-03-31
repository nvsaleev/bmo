"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { AgCharts } from "ag-charts-react";
import { Stock } from "../types";
import {AgChartOptions, AgChartCaptionOptions, AgLineSeriesOptions} from "ag-charts-community";

import {FeedData} from "../types";
import { getPriceHistory, getFeed } from "../pricingAPI";
const pollingFrequency = 4000; // 60000 is 1 minute 6000 is 6 seconds

interface StockChartProps {
  selectedStocks: Stock[];
}

// contains a timestamp and ticker: price key-value pairs
interface PriceDataPoint { [key: string]: number | Date }


export default function StockChart({ selectedStocks }: StockChartProps) {

  // const lastTimestamp = useState<string | null>(null);
  const [chartData, setChartData] = useState<PriceDataPoint[]>([]);
  const chartLastTimestampRef = useRef<Date | null>(null);

  // Unlike Series data, Series definitions chage only when selected stocks change
  // useMemo prevents re-computing series when data changes
  const series = useMemo(() => {
    return makeSeries(selectedStocks);
  }, [selectedStocks]);
  
  // Effect to fetch historical data and set up periodic updates
  useEffect(() => {

    const fetchHistoricalData = async () => {

      if (selectedStocks.length === 0) {
        return;
      }

      const tickers = selectedStocks.map((stock: Stock) => stock.ticker);
      const data = await getPriceHistory(tickers);

      const priceData: PriceDataPoint[] = data.timestamp.map((timestamp: string, index: number) => {
        const priceDataPoint: PriceDataPoint = { timestamp: new Date(timestamp) }; // fix this type
        data.price_history.forEach((stock: { ticker: string; prices: number[] }) => {
          priceDataPoint[stock.ticker] = stock.prices[index];
        });
        return priceDataPoint;
      });

      setChartData(priceData as PriceDataPoint[]); // fix this type
      chartLastTimestampRef.current = priceData[priceData.length - 1].timestamp as Date;
    };

    const makeNewFeedDataPoint = (feedData: FeedData) => {
      const newPricePoint: PriceDataPoint = { timestamp: new Date(feedData.feed[0].timestamp), };
      feedData.feed.forEach((item) => {
        newPricePoint[item.ticker] = item.price;
      });
      return newPricePoint;
    };

    fetchHistoricalData();

    const intervalId = setInterval(async () => {
      if (selectedStocks.length === 0 ) {
        return;
      }
      const tickers = selectedStocks.map((stock: Stock) => stock.ticker);
      const newFeedData = await getFeed(tickers);
      const newPricePoint = makeNewFeedDataPoint(newFeedData);

      console.log(chartLastTimestampRef.current)
      console.log(newPricePoint.timestamp)

      const lastTime = newPricePoint.timestamp as Date;

      if ((chartLastTimestampRef.current) && (chartLastTimestampRef.current.getTime() === lastTime.getTime())) {
        console.log("Skipping duplicate timestamp");
        return
      }
      
      console.log("Adding new price point");
      chartLastTimestampRef.current = lastTime;
      setChartData((prevPriceData) => [...prevPriceData, newPricePoint] as PriceDataPoint[]);

    }, pollingFrequency);

    return () => clearInterval(intervalId);
  }, [selectedStocks]);

  // Compute chart options with repositioned legend
  const chartOptions = useMemo(() => {
    return {
      axes: stockChartAxes,
      legend: { enabled: true, position: "bottom" },
      title: {text: "Stock Prices"} as AgChartCaptionOptions,
      series,
      data: chartData,
    } as AgChartOptions;
  }, [chartData, series]);

  // Render logic
  return (
    <div className="w-full h-full flex items-center justify-center">
      {(chartData.length > 0) ? <AgCharts className="w-full h-full" options={chartOptions} /> : <p>Select stocks...</p>}
    </div>
  );
}


function makeSeries(stocks: Stock[]): AgLineSeriesOptions[] {
  const tickers = stocks.map((stock: Stock) => stock.ticker);
  return tickers.map((ticker) => ({
    type: "line",
    xKey: "timestamp",
    yKey: ticker,
    yName: ticker,
    marker: { enabled: false },
    tooltip: {
      renderer: (params) => {
        const { datum, xKey, yKey, title } = params;
        const date = datum[xKey];
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}`;
        const value = datum[yKey].toFixed(2);
        return `${title}: $${value} at ${formattedDate}`;
      },
    },
  } as AgLineSeriesOptions));
}

const stockChartAxes = [
  {
    type: "time",
    position: "bottom",
    label: {
      format: "%Y-%m-%d %H:%M",
    },
  },
  {
    type: "number",
    position: "left",
    label: {
      formatter: (params: { value: number; }) => `$${params.value.toFixed(2)}`,
    },
  },
]