import { Geist, Geist_Mono } from "next/font/google";
// import { Analytics } from "@vercel/analytics/next";

import "./globals.css";

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata = {
  title: "Red Packet Monitor",
  description: "Monitor and claim Binance Red Packets from Twitter",
  generator: "v0.app",
  icons: {
    icon: [
      {
        url: "/icon-light-32x32.png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/icon-dark-32x32.png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: "/icon.svg",
        type: "image/svg+xml",
      },
    ],
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${_geist.variable} ${_geistMono.variable} bg-background`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background">
        {children}
        {/* {process.env.NODE_ENV === "production" && <Analytics />} */}
      </body>
    </html>
  );
}
