import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Laparpo Lead Intelligence",
    template: "%s · Laparpo Lead Intelligence",
  },
  description: "Lead prospecting and sales assistance for Laparpo Production.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
