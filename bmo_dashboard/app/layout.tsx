import type { Metadata } from "next";
import {Heebo } from "next/font/google";
import "./globals.css";

import Navbar from "./components/Navbar";

const heebo = Heebo({
  subsets: ["latin"],
});


export const metadata: Metadata = {
  title: "BMO Pricing",
  description: "BMO Takehome Assessment",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${heebo.className}` + "w-screen h-screen max-w-screen  max-h-screen"}>
        <Navbar>
          <div className="min-h-screen pt-24 h-full w-full">
            {children}
          </div>
        </Navbar>
      </body>
    </html>
  );
}