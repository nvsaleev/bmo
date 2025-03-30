"use client";

import { useEffect, useState, useMemo } from "react";
import { AgCharts } from "ag-charts-react";
import { Stock } from "../types";

import { getPriceHistory, getFeed } from "../api/pricing";
const pollingFrequency = 4000; // 60000 is 1 minute 6000 is 6 seconds

interface StockChartProps {
  selectedStocks: Stock[];
}

export default function StockChart({ selectedStocks }: StockChartProps) {
  // State for chart data and error handling
  const lastTimestamp = useState<string | null>(null);
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState<string | null>(null);

  // Define chart series with enhanced tooltip
  const series = useMemo(() => {
    const tickers = selectedStocks.map((stock: Stock) => stock.ticker);
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
    }));
  }, [selectedStocks]);

  // efine chart axes with custom date and currency formatting
  const axes = [
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
        formatter: (params) => `$${params.value.toFixed(2)}`,
      },
    },
  ];

  // Effect to fetch historical data and set up periodic updates
  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        if (selectedStocks.length === 0) {
          setChartData([]);
          setError(null);
          return;
        }
        const tickers = selectedStocks.map((stock: Stock) => stock.ticker);
        const data = await getPriceHistory(tickers);
        const processedData = data.timestamp.map((timestamp: string, index: number) => {
          const dataPoint: { [key: string]: any } = { timestamp: new Date(timestamp) };
          data.price_history.forEach((stock: { ticker: string; prices: number[] }) => {
            dataPoint[stock.ticker] = stock.prices[index];
          });
          return dataPoint;
        });
        setChartData(processedData);
        setError(null);
      } catch (error: any) {
        console.error("Failed to fetch historical data:", error);
        setError(error.message);
        setChartData([]);
      }
    };

    

    const processNewData = (feedData: { feed: { ticker: string; price: number; timestamp: string }[] }) => {
      const newDataPoint: { [key: string]: any } = {
        timestamp: new Date(feedData.feed[0].timestamp),
      };
      feedData.feed.forEach((item) => {
        newDataPoint[item.ticker] = item.price;
      });
      return newDataPoint;
    };

    fetchHistoricalData();

    const intervalId = setInterval(async () => {
      if (selectedStocks.length === 0 ) {
        return;
      }
      try {
        const tickers = selectedStocks.map((stock: Stock) => stock.ticker);
        const newData = await getFeed(tickers);
        const newDataPoint = processNewData(newData);
        setChartData((prevData) => [...prevData, newDataPoint]);
      } catch (error) {
        console.error("Failed to fetch feed data:", error);
      }
    }, pollingFrequency);

    return () => clearInterval(intervalId);
  }, [selectedStocks]);

  // Compute chart options with repositioned legend
  const chartOptions = useMemo(() => {
    return {
      data: chartData,
      series,
      axes,
      legend: {
        enabled: true,
        position: "bottom",
      },
      navigator: {
        enabled: true,
        height: 40,
        miniChart: {
          enabled: true,
        },
      },
      zoom: {
        enabled: true,
      },
      initialState: {
        zoom: {
          ratioX: { start: 0.9, end: 1 },
        },
      },
    };
  }, [chartData, series, axes]);

  // Render logic
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        Error: {error}
      </div>
    );
  } else if (chartData.length > 0) {
    return (
      <div className="w-full h-full">
        <AgCharts className="w-full h-full" options={chartOptions} />
      </div>
    );
  } else {
    return (
      <div className="w-full h-full flex items-center justify-center">
        Select stocks...
      </div>
    );
  }
}