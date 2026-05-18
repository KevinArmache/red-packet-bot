import { Outfit } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata = {
  title: "Red Packet Monitor",
  description: "Monitor and claim Binance Red Packets from Twitter",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="fr"
      className={`${outfit.variable}`}
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
