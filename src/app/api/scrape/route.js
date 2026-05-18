import { NextResponse } from "next/server";
import { scrapeAccounts } from "@/lib/scraper";
import { addScrapeLog } from "@/lib/db";
import { autoClaimPendingCodes } from "@/app/actions";

// Route cron — appelée par Vercel Cron (vercel.json) ou manuellement
// GET /api/scrape
export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60 secondes max pour le scraping

export async function GET(request) {
  // Vérification optionnelle du CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    // Vercel Cron envoie le secret dans le header Authorization
    if (authHeader !== `Bearer ${cronSecret}`) {
      addScrapeLog("warn", "Cron — tentative non autorisée");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    addScrapeLog("info", "Cron scrape déclenché");
    const result = await scrapeAccounts();

    // Déclencher l'auto-claim en arrière-plan
    autoClaimPendingCodes().catch((err) => {
      console.error("Erreur autoClaim en arrière-plan:", err);
    });

    return NextResponse.json({
      success: true,
      codesFound: result.codesFound,
      accountsScraped: result.accountsScraped,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    addScrapeLog("error", `Cron scrape échoué: ${message}`);

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
