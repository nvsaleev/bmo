"use client";

import { GrDocumentConfig } from "react-icons/gr";
import { AgGridReact } from "ag-grid-react";
import { useState, useCallback, useRef } from "react";
import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

interface Stock {
  ticker: string;
  open: number;
  drift: number;
  volatility: number;
}

interface GridComponentProps {
  stocks: Stock[];
  removeTicker: (ticker: string) => void;
  updateTicker: (ticker: string, volatility: number, drift: number) => void;
}

export default function GridComponent({
  stocks,
  removeTicker,
  updateTicker,
}: GridComponentProps) {
  const gridRef = useRef<any>(null);

  const [colDefs] = useState([
    { field: "ticker", flex: 1 },
    { field: "volatility", flex: 1 },
    { field: "drift", flex: 1 },
    {
      field: "config",
      headerName: "",
      width: 60,
      cellRenderer: (params: any) => {
        const handleClick = () => {
          updateTicker(
            params.data.ticker,
            params.data.volatility,
            params.data.drift
          );
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
      cellRenderer: (params: any) => {
        const handleClose = () => {
          removeTicker(params.data.ticker);
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
              className="cursor-pointer text-red-700 hover:scale-100 mx-auto"
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

  const onGridReady = useCallback((params: any) => {
    // Store the grid API reference
    if (gridRef.current) {
      gridRef.current = params.api;

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
        rowData={stocks}
        columnDefs={colDefs}
        onGridReady={onGridReady}
        defaultColDef={{
          resizable: true,
        }}
      />
    </div>
  );
}
