import { NextResponse } from "next/server";
import { getBotStatus, getRedPacketCodes, getSetting, getActivityMeta } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/status
 * Retourne l'état du bot, les statistiques des codes et les métadonnées d'activité.
 * Appelé en polling adaptatif par les composants client.
 */
export async function GET() {
  try {
    const botStatus = getBotStatus();
    const codes = getRedPacketCodes();
    const scrapingEnabled = getSetting("scraping_enabled") === "true";
    const activityMeta = getActivityMeta();

    const stats = {
      total: codes.length,
      unverified: codes.filter((c) => c.status === "unverified").length,
      claiming: codes.filter((c) => c.status === "claiming").length,
      claimed: codes.filter((c) => c.status === "claimed").length,
      failed: codes.filter(
        (c) => c.status === "failed" || c.status === "invalid" || c.status === "expired" || c.status === "empty"
      ).length,
    };

    return NextResponse.json({
      botStatus,
      scrapingEnabled,
      stats,
      hasActiveCodes: stats.unverified > 0 || stats.claiming > 0,
      activityMeta,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ botStatus: "idle", error: err.message }, { status: 500 });
  }
}
