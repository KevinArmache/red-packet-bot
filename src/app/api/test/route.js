import { NextResponse } from "next/server";
import { addRedPacketCode, addScrapeLog, getRedPacketCodes } from "@/lib/db";
import { verifyGiftCard, redeemGiftCard } from "@/lib/binance";
import { extractRedPacketCodes } from "@/lib/scraper";

export const dynamic = "force-dynamic";

// Route de test pour valider le workflow complet
// GET /api/test?step=all|extract|verify|claim&code=BPxxxxxxxx
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const step = searchParams.get("step") || "all";
  const testCode = searchParams.get("code") || "BPTEST12345678"; // Code de test fictif

  const results = {};

  // ─── TEST 1 : Extraction de codes ───────────────────
  if (step === "all" || step === "extract") {
    const sampleTexts = [
      `🎁 Binance Red Packet! Grab your ${testCode} gift card before it expires! #Binance`,
      `Happy new year! Here's a red packet: ${testCode} — first come first served!`,
      `No code here, just a regular tweet about crypto.`,
    ];

    const extractionResults = sampleTexts.map((text) => ({
      text: text.substring(0, 60) + "...",
      codes: extractRedPacketCodes(text),
    }));

    results.extraction = {
      success: true,
      tests: extractionResults,
      regex: "BP[0-9A-Za-z]{8,20}",
    };
  }

  // ─── TEST 2 : Vérification Binance API ──────────────
  if (step === "all" || step === "verify") {
    const verifyResult = await verifyGiftCard(testCode);
    results.verification = {
      code: testCode,
      result: verifyResult,
      note: process.env.BINANCE_TEST_MODE === "true"
        ? "Mode test activé — réponse simulée"
        : "Appel API Binance réel",
    };
  }

  // ─── TEST 3 : Claim Binance API ─────────────────────
  if (step === "claim") {
    const claimResult = await redeemGiftCard(testCode);
    results.claim = {
      code: testCode,
      result: claimResult,
    };
  }

  // ─── TEST 4 : Base de données ────────────────────────
  if (step === "all" || step === "db") {
    // Ajouter un code test
    const added = addRedPacketCode(
      `BPDBTEST${Date.now().toString().slice(-8)}`,
      "Test tweet from /api/test",
      `test-${Date.now()}`,
      "test"
    );
    const codes = getRedPacketCodes();
    addScrapeLog("info", "Test DB depuis /api/test");

    results.database = {
      success: true,
      codeAdded: added ? added.code : null,
      totalCodes: codes.length,
    };
  }

  // ─── TEST 5 : Variables d'env ───────────────────────
  if (step === "all" || step === "env") {
    results.environment = {
      BINANCE_API_KEY: process.env.BINANCE_API_KEY ? "✅ configuré" : "❌ manquant",
      BINANCE_SECRET_KEY: process.env.BINANCE_SECRET_KEY ? "✅ configuré" : "❌ manquant",
      BINANCE_TEST_MODE: process.env.BINANCE_TEST_MODE || "false",
      TWITTER_BEARER_TOKEN: process.env.TWITTER_BEARER_TOKEN ? "✅ configuré" : "⚠️ manquant (scraping Twitter API v2 désactivé)",
      CRON_SECRET: process.env.CRON_SECRET ? "✅ configuré" : "⚠️ non sécurisé",
      NODE_ENV: process.env.NODE_ENV,
    };
  }

  return NextResponse.json({
    success: true,
    step,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
