import { NextResponse } from "next/server";
import { getBotStatus, getRedPacketCodes, getSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/status
 * Retourne l'état du bot et les statistiques des codes.
 * Appelé en polling par les composants client (BotStatusBanner, CodesTable).
 */
export async function GET() {
  try {
    const botStatus = getBotStatus();
    const codes = getRedPacketCodes();
    const scrapingEnabled = getSetting("scraping_enabled") === "true";

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
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return NextResponse.json({ botStatus: "idle", error: err.message }, { status: 500 });
  }
}
