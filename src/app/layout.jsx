import { Geist } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Geist Mono est retiré — il cause un bug Turbopack dans Next.js 16
// (Cannot resolve @vercel/turbopack-next/internal/font/google/font)
const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export const metadata = {
  title: "Red Packet Monitor",
  description: "Monitor and claim Binance Red Packets from Twitter",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${geist.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased bg-background" suppressHydrationWarning={true}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
