"use client";

import { useEffect, useState } from "react";
import { AgCharts } from "ag-charts-react";

interface StockChartProps {
  tickers: string[];
}

export default function StockChart({ tickers }: StockChartProps) {
  // State for chart options and error handling
  const [chartOptions, setChartOptions] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // If no tickers are provided, clear the chart and exit
        if (tickers.length === 0) {
          setChartOptions(null);
          setError(null);
          return;
        }

        // Determine the API URL
        const stocksUrl = process.env.BFF_HOST
          ? `${process.env.BFF_HOST}/api/v1/stocks/history`
          : "http://localhost:8080/api/v1/stocks/history";

        // Fetch the stock data
        const response = await fetch(stocksUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ tickers: tickers }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Process the data for AG Charts
        const chartData = data.timestamp.map((timestamp, index) => {
          const dataPoint = { timestamp: new Date(timestamp) }; // Convert ISO string to Date object
          data.price_history.forEach((stock) => {
            dataPoint[stock.ticker] = stock.prices[index]; // Add price for each ticker
          });
          return dataPoint;
        });

        // Define series (one line per ticker)
        const series = data.price_history.map((stock) => ({
          type: "line",
          xKey: "timestamp",
          yKey: stock.ticker,
          yName: stock.ticker, // Display ticker name in legend
        }));

        // Define axes
        const axes = [
          {
            type: "time",
            position: "bottom",
          },
          {
            type: "number",
            position: "left",
          },
        ];

        // Set chart options
        const options = {
          data: chartData,
          series: series,
          axes: axes,
        };

        setChartOptions(options);
        setError(null);
      } catch (error) {
        console.error("Failed to fetch stock data:", error);
        setError(error.message);
        setChartOptions(null);
      }
    };

    fetchData();
  }, [tickers]); // Re-run when tickers change

  // Render based on state
  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        Error: {error}
      </div>
    );
  } else if (chartOptions) {
    return (
      <div className="w-full h-full">
        <AgChartsReact options={chartOptions} />
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