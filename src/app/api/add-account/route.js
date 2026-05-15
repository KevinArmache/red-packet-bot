import { NextResponse } from "next/server";
import { addMonitoredAccount, addScrapeLog } from "@/lib/db";

export const dynamic = "force-dynamic";

// POST /api/add-account — ajouter un compte à surveiller
export async function POST(request) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username) {
      return NextResponse.json(
        { success: false, error: "username est requis" },
        { status: 400 }
      );
    }

    const clean = username.trim().toLowerCase().replace(/^@/, "");
    if (!clean) {
      return NextResponse.json(
        { success: false, error: "username invalide" },
        { status: 400 }
      );
    }

    const result = addMonitoredAccount(clean);
    if (!result) {
      return NextResponse.json({
        success: false,
        error: "Compte déjà surveillé",
      });
    }

    addScrapeLog("info", `Compte ajouté via API: @${clean}`);
    return NextResponse.json({ success: true, account: result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: msg },
      { status: 500 }
    );
  }
}
