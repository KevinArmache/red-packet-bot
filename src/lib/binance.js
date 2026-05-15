import CryptoJS from "crypto-js";

const BINANCE_API_URL = "https://api.binance.com";

function getConfig() {
  const apiKey = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;
  const testMode = process.env.BINANCE_TEST_MODE === "true";

  if (!apiKey || !secretKey) {
    throw new Error("Identifiants API Binance non configurés");
  }

  return { apiKey, secretKey, testMode };
}

function generateSignature(queryString, secretKey) {
  return CryptoJS.HmacSHA256(queryString, secretKey).toString(CryptoJS.enc.Hex);
}

// ─── Réponses simulées (mode test) ───────────────────────────────────────────
function simulateVerifyResponse(code) {
  // En mode test : les codes BP valides (8+ chars alphanum) sont considérés valides
  if (/^BP[0-9A-Za-z]{8,}$/.test(code)) {
    return {
      success: true,
      data: {
        valid: true,
        token: "USDT",
        amount: "1.00000000",
        referenceNo: `TEST-${Date.now()}`,
      },
    };
  }
  return {
    success: true,
    data: { valid: false, token: "", amount: "0" },
  };
}

function simulateRedeemResponse(code) {
  if (/^BP[0-9A-Za-z]{8,}$/.test(code)) {
    return {
      success: true,
      data: {
        referenceNo: `TEST-REF-${Date.now()}`,
        identityNo: `TEST-ID-${Date.now()}`,
        token: "USDT",
        amount: "1.00000000",
      },
    };
  }
  return {
    success: false,
    error: "Code cadeau invalide",
    code: "000002",
  };
}

// ─── Vérification d'un Gift Card Number (referenceNo public) ─────────────────
// ⚠️ ATTENTION : /verify attend un Gift Card Number (référence publique),
// PAS le Redemption Code (BP...). Cette fonction est utile si on a la
// référence publique du gift card, pas le code de rachat.
export async function verifyGiftCardByRef(referenceNo) {
  try {
    const config = getConfig();

    if (config.testMode) {
      await new Promise((r) => setTimeout(r, 500));
      return simulateVerifyResponse(referenceNo);
    }

    const timestamp = Date.now();
    const queryParams = `referenceNo=${encodeURIComponent(referenceNo)}&timestamp=${timestamp}`;
    const signature = generateSignature(queryParams, config.secretKey);

    const url = `${BINANCE_API_URL}/sapi/v1/giftcard/verify?${queryParams}&signature=${signature}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": config.apiKey,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.msg || "Vérification échouée",
        code: data.code?.toString(),
      };
    }

    return {
      success: true,
      data: {
        valid: data.data?.valid ?? false,
        token: data.data?.token || "",
        amount: data.data?.amount || "0",
        referenceNo: data.data?.referenceNo,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ─── Rachat d'un Redemption Code (code BP...) ────────────────────────────────
// C'est la vraie fonction à utiliser avec les codes scrapés de Twitter.
// Elle appelle /sapi/v1/giftcard/redeemCode avec le param "code".
export async function redeemGiftCard(code) {
  try {
    const config = getConfig();

    if (config.testMode) {
      await new Promise((r) => setTimeout(r, 500));
      return simulateRedeemResponse(code);
    }

    const timestamp = Date.now();
    const queryParams = `code=${encodeURIComponent(code)}&timestamp=${timestamp}`;
    const signature = generateSignature(queryParams, config.secretKey);

    const url = `${BINANCE_API_URL}/sapi/v1/giftcard/redeemCode`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": config.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `${queryParams}&signature=${signature}`,
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.msg || "Rachat échoué",
        code: data.code?.toString(),
      };
    }

    return {
      success: true,
      data: {
        referenceNo: data.data?.referenceNo || "",
        identityNo: data.data?.identityNo || "",
        token: data.data?.token || "",
        amount: data.data?.amount || "0",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ─── Alias : verifyGiftCard pointe vers redeemCode en mode "vérification" ────
// Les codes BP scrapés sont des Redemption Codes — on les vérifie en essayant
// de les racheter en mode test, ou en tentant un dry-run si disponible.
// En production : on tente directement le redeem (c'est la seule vraie vérification).
export async function verifyGiftCard(code) {
  try {
    const config = getConfig();

    // En mode test, on simule une réponse valide
    if (config.testMode) {
      await new Promise((r) => setTimeout(r, 500));
      return simulateVerifyResponse(code);
    }

    // En production : on tente le rachat. Si succès → code valide et réclamé.
    // Cette approche est délibérée : il n'y a pas d'endpoint de "dry-run" pour
    // les Redemption Codes dans l'API Binance Gift Card.
    const redeemResult = await redeemGiftCard(code);

    if (redeemResult.success) {
      return {
        success: true,
        data: {
          valid: true,
          token: redeemResult.data.token,
          amount: redeemResult.data.amount,
          referenceNo: redeemResult.data.referenceNo,
          // Flag pour indiquer que le code a déjà été réclamé lors de la vérif
          alreadyClaimed: true,
        },
      };
    }

    // Si erreur "déjà racheté" → code était valide
    if (redeemResult.code === "000003") {
      return {
        success: true,
        data: { valid: false, token: "", amount: "0", reason: "already_redeemed" },
      };
    }

    // Si erreur "expiré" → code invalide
    if (redeemResult.code === "000004") {
      return {
        success: true,
        data: { valid: false, token: "", amount: "0", reason: "expired" },
      };
    }

    // Autres erreurs → code probablement invalide
    return {
      success: true,
      data: { valid: false, token: "", amount: "0" },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Erreur inconnue",
    };
  }
}

// ─── Codes d'erreur Binance ───────────────────────────────────────────────────
export const BINANCE_ERROR_CODES = {
  "000001": "Erreur système",
  "000002": "Code cadeau invalide",
  "000003": "Ce code a déjà été racheté",
  "000004": "Ce code a expiré",
  "000005": "Code cadeau non disponible",
  "000006": "Restriction géographique",
  "000007": "Vérification du compte requise",
  "000008": "Limite journalière de rachat atteinte",
  "000009": "Solde insuffisant",
  "000018": "Format de code invalide",
};

export function getErrorMessage(code) {
  if (!code) return "Erreur inconnue";
  return BINANCE_ERROR_CODES[code] || `Code d'erreur: ${code}`;
}
