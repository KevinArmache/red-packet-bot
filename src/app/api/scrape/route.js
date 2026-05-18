import { NextResponse } from "next/server";
import { scrapeAccounts } from "@/lib/scraper";
import { addScrapeLog } from "@/lib/db";
import { runCronWorkflow } from "@/app/actions";

// Route cron — appelée par Vercel Cron (vercel.json) ou manuellement
// GET /api/scrape
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      addScrapeLog("warn", "Cron — tentative non autorisée");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    addScrapeLog("info", "Cron scrape déclenché via API");
    // Utiliser le workflow complet (scrape + claim automatique)
    const result = await runCronWorkflow();

    return NextResponse.json({
      success: result.success,
      message: result.success
        ? "Workflow lancé en arrière-plan"
        : result.error,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addScrapeLog("error", `Cron scrape échoué: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
