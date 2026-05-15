import { NextResponse } from "next/server";
import { addRedPacketCode, addScrapeLog } from "@/lib/db";
import { extractRedPacketCodes } from "@/lib/scraper";

// External code ingestion endpoint
// Can be called by external scrapers (e.g., Python script) to add codes
export async function POST(request) {
  try {
    const body = await request.json();
    const { text, author, code, tweetId } = body;

    // If a specific code is provided, use it directly
    if (code) {
      const result = addRedPacketCode(
        code,
        text || code,
        tweetId || null,
        author || "external",
      );
      if (result) {
        addScrapeLog("info", `External ingestion: Added code ${code}`);
        return NextResponse.json({
          success: true,
          code: result.code,
          id: result.id,
        });
      } else {
        return NextResponse.json({
          success: false,
          error: "Code already exists or could not be added",
        });
      }
    }

    // Otherwise, extract codes from text
    if (!text) {
      return NextResponse.json(
        { success: false, error: "Either code or text is required" },
        { status: 400 },
      );
    }

    const codes = extractRedPacketCodes(text);
    if (codes.length === 0) {
      return NextResponse.json({
        success: false,
        error: "No valid red packet codes found in text",
      });
    }

    const added = [];
    const skipped = [];

    for (const extractedCode of codes) {
      const result = addRedPacketCode(
        extractedCode,
        text,
        tweetId || null,
        author || "external",
      );
      if (result) {
        added.push(extractedCode);
        addScrapeLog("info", `External ingestion: Added code ${extractedCode}`);
      } else {
        skipped.push(extractedCode);
      }
    }

    return NextResponse.json({
      success: true,
      codesFound: codes.length,
      codesAdded: added.length,
      added,
      skipped,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    addScrapeLog("error", `External ingestion failed: ${errorMessage}`);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 },
    );
  }
}
