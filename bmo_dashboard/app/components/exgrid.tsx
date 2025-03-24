// components/GridComponent.tsx
"use client";

import { GrFormClose, GrDocumentConfig } from "react-icons/gr";
import { AgGridReact } from 'ag-grid-react';
import { useState } from "react";
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

export default function GridComponent({ stocks, removeTicker, updateTicker }: GridComponentProps) {
    // Row Data: The data to be displayed.
  
    // Column Definitions: Defines & controls grid columns.
    const [colDefs, setColDefs] = useState([
      { field: "ticker" },
      { field: "volatility" },
      { field: "drift" },
      {
        field: "config",
        headerName: "update", // Optional: remove header text
        width: 60, // Fixed width for the close button column
        cellRenderer: (params: any) => {
          const handleClose = () => {
            // Filter out the row with the clicked ticker
            updateTicker(params.data.ticker, params.data.volatility, params.data.drift);
          };
  
          return (
            <span
              onClick={handleClose}
              title="Update"
              className="flex flex-row items-center justify-center text-lg cursor-pointer text-bmo-blue hover:text-bmo-dark-blue"
            >
              <GrDocumentConfig/> 
            </span>
          );
        },
        sortable: false, // Disable sorting for this column
        filter: false,   // Disable filtering for this column
      },
      {
        field: "config",
        headerName: "close", // Optional: remove header text
        width: 60, // Fixed width for the close button column
        cellRenderer: (params: any) => {
          const handleClose = () => {
            // Filter out the row with the clicked ticker
            removeTicker(params.data.ticker);
          };
  
          return (
            <span
              onClick={handleClose}
              title="Close"
              className="cursor-pointer text-red-700 hover:scale-100"
            >
              ✕ 
            </span>
          );
        },
        sortable: false, // Disable sorting for this column
        filter: false,   // Disable filtering for this column
      },

    ]);
  ;

  const onGridReady = (params: { api: { sizeColumnsToFit: () => void; }; }) => {
      console.log('Grid API:', params.api);
      if (params.api) {
          params.api.sizeColumnsToFit();
      } else {
          console.error('Grid API is not available');
      }
    };
  
    // Container: Defines the grid's theme & dimensions.
    return (
        <>
        <div style={{ width: "100%", height: "100%" }}>
            <AgGridReact rowData={stocks} columnDefs={colDefs} onGridReady={onGridReady} />
            
        </div>
        </>
     
    );
  };
