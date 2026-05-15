"use client";

import { TooltipProvider } from "@/components/ui/tooltip";

export function Providers({ children }) {
  return <TooltipProvider>{children}</TooltipProvider>;
}
