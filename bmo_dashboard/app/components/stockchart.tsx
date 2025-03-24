"use client";

import { useEffect, useState, useMemo } from "react";
import { AgCharts } from "ag-charts-react";

interface StockChartProps {
  tickers: string[];
}

export default function StockChart({ tickers }: StockChartProps) {
  // State for chart data and error handling
  const [chartData, setChartData] = useState([]);
  const [error, setError] = useState<string | null>(null);

  // Define chart series based on tickers (recomputed only when tickers change)
  const series = useMemo(() => {
    return tickers.map((ticker) => ({
      type: "line",
      xKey: "timestamp",
      yKey: ticker,
      yName: ticker,
      marker: { enabled: false },
      tooltip: {
        renderer: (params) => {
          const { datum, xKey, yKey } = params;
          const date = datum[xKey];
          const formattedDate = date.toLocaleString(undefined, {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
          const value = datum[yKey];
          return `${formattedDate}: ${value}`;
        },
      },
    }));
  }, [tickers]);

  // Define chart axes (static configuration)
  const axes = [
    { type: "time", position: "bottom" },
    { type: "number", position: "left" },
  ];

  // Effect to fetch historical data and set up periodic updates
  useEffect(() => {
    // Fetch historical data
    const fetchHistoricalData = async () => {
      try {
        if (tickers.length === 0) {
          setChartData([]);
          setError(null);
          return;
        }
        const stocksUrl = process.env.BFF_HOST
          ? `${process.env.BFF_HOST}/api/v1/stocks/history`
          : "http://localhost:8080/api/v1/stocks/history";
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
        const data = await response.json();
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

    // Function to fetch feed data
    const getFeed = async (tickers: string[]) => {
      const feedUrl = process.env.BFF_HOST
        ? `${process.env.BFF_HOST}/api/v1/stocks/feed`
        : "http://localhost:8080/api/v1/stocks/feed";
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
      const data = await response.json();
      console.log("Feed data:", data);
      return data;
    };

    // Process feed data into a chart-compatible data point
    const processNewData = (feedData: { feed: { ticker: string; price: number; timestamp: string }[] }) => {
      const newDataPoint: { [key: string]: any } = {
        timestamp: new Date(feedData.feed[0].timestamp),
      };
      feedData.feed.forEach((item) => {
        newDataPoint[item.ticker] = item.price;
      });
      return newDataPoint;
    };

    // Fetch initial data
    fetchHistoricalData();

    // Set up interval for periodic updates
    const intervalId = setInterval(async () => {
      try {
        const newData = await getFeed(tickers);
        const newDataPoint = processNewData(newData);
        setChartData((prevData) => [...prevData, newDataPoint]);
      } catch (error) {
        console.error("Failed to fetch feed data:", error);
        // Continue displaying the chart; only log the error
      }
    }, 60000); // 60,000 ms = 1 minute

    // Cleanup interval on unmount or when tickers change
    return () => clearInterval(intervalId);
  }, [tickers]);

  // Compute chart options dynamically
  const chartOptions = useMemo(() => {
    return {
      data: chartData,
      series,
      axes,
      legend: {
        enabled: true,
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
        Loading...
      </div>
    );
  }
}