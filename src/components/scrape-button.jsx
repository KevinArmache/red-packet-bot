"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { triggerScrape } from "@/app/actions";
import { toast } from "sonner";

export function ScrapeButton() {
  const [isPending, startTransition] = useTransition();

  const handleScrape = () => {
    startTransition(async () => {
      const result = await triggerScrape();
      if (result.errors.length > 0) {
        toast.warning(
          `Scraped ${result.accountsScraped} accounts, found ${result.codesFound} codes. ${result.errors.length} error(s) occurred.`,
        );
      } else {
        toast.success(
          `Scraped ${result.accountsScraped} accounts, found ${result.codesFound} new codes.`,
        );
      }
    });
  };

  return (
    <Button onClick={handleScrape} disabled={isPending}>
      {isPending ? (
        <Spinner className="size-4" />
      ) : (
        <RefreshCw className="size-4" data-icon="inline-start" />
      )}
      {isPending ? "Scraping..." : "Scrape Now"}
    </Button>
  );
}
