import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "MausamSetu",
  description: "MausamSetu gives model-generated panchayat weather estimates for agro-advisory decision support. Not official IMD forecasts.",
  icons: { icon: "/mausamsetu-logo.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
