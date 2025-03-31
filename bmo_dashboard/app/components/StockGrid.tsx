"use client";

import { GrDocumentConfig } from "react-icons/gr";
import { AgGridReact } from "ag-grid-react";
import { useState, useCallback, useRef } from "react";
import { AllCommunityModule, ModuleRegistry, ICellRendererParams, GridReadyEvent} from "ag-grid-community";
import { Stock } from "../types";



ModuleRegistry.registerModules([AllCommunityModule]);



interface StockGridProps {
  selectedStocks: Stock[];
  removeStock: (ticker: string) => void;
  setStockToUpdate: (stockToUpdate: Stock | null) => void;
}

export default function StockGrid({
  selectedStocks,
  removeStock,
  setStockToUpdate,
}: StockGridProps) {

  const gridRef = useRef<AgGridReact>(null);

  const [colDefs] = useState([
    { field: "ticker", flex: 1, headerStyle: { fontWeight: 'bold' } },
    { field: "volatility", flex: 1, headerStyle: { fontWeight: 'bold' } },
    { field: "drift", flex: 1, headerStyle: { fontWeight: 'bold' } },
    {
      field: "config",
      headerName: "",
      width: 60,
      cellRenderer: (params: ICellRendererParams) => {
        const handleClick = () => {
          const newStock: Stock = {ticker: params.data.ticker, volatility: params.data.volatility, drift: params.data.drift, open: params.data.open };
          setStockToUpdate(newStock);
        };

        return (
          <div
            onClick={handleClick}
            title="Update"
            className="w-full h-full flex flex-row items-center justify-center text-lg cursor-pointer text-bmo-blue hover:text-bmo-dark-blue"
          >
            <GrDocumentConfig />
          </div>
        );
      },
      sortable: false,
      filter: false,
    },
    {
      field: "remove",
      headerName: "",
      width: 60,
      cellRenderer: (params: ICellRendererParams) => {
        const handleClose = () => {
          removeStock(params.data.ticker);
        };

        return (
          <div
            onClick={handleClose}
            title="Update"
            className="w-full h-full flex flex-row items-center justify-center text-lg cursor-pointer text-bmo-blue hover:text-bmo-dark-blue"
          >
            <span
              onClick={handleClose}
              title="Close"
              className="cursor-pointer text-red-700 hover:text-red-500 duration-150 mx-auto"
            >
              ✕
            </span>
          </div>
        );
      },
      sortable: false,
      filter: false,
    },
  ]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    // Store the grid API reference
    if (gridRef.current) {
      gridRef.current.api = params.api;

      // Use setTimeout to ensure the grid is fully rendered
      setTimeout(() => {
        params.api.sizeColumnsToFit();
      }, 0);
    }
  }, []);

  return (
    <div className="ag-theme-alpine w-full h-full">
      <AgGridReact
        ref={gridRef}
        rowData={selectedStocks}
        columnDefs={colDefs}
        onGridReady={onGridReady}
        defaultColDef={{
          resizable: true,
        }}
      />
    </div>
  );
}
