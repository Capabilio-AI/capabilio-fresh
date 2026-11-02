import { Archivo } from "next/font/google";

// One family with a width axis: expanded and heavy for the sheet titles, normal width for reading.
export const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
  display: "swap",
});
