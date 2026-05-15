import CryptoJS from "crypto-js";

const BINANCE_API_URL = "https://api.binance.com";

function getConfig() {
  const apiKey = process.env.BINANCE_API_KEY;
  const secretKey = process.env.BINANCE_SECRET_KEY;
  const testMode = process.env.BINANCE_TEST_MODE === "true";

  if (!apiKey || !secretKey) {
    throw new Error("Binance API credentials not configured");
  }

  return { apiKey, secretKey, testMode };
}

function generateSignature(queryString, secretKey) {
  return CryptoJS.HmacSHA256(queryString, secretKey).toString(CryptoJS.enc.Hex);
}

// Simulated responses for test mode
function simulateVerifyResponse(code) {
  if (code.startsWith("BP") && code.length >= 10) {
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
    data: {
      valid: false,
      token: "",
      amount: "0",
    },
  };
}

function simulateRedeemResponse(code) {
  if (code.startsWith("BP") && code.length >= 10) {
    return {
      success: true,
      data: {
        referenceNo: `TEST-${Date.now()}`,
        identityNo: `ID-${Date.now()}`,
        token: "USDT",
        amount: "1.00000000",
      },
    };
  }
  return {
    success: false,
    error: "Invalid gift card code",
    code: "000018",
  };
}

export async function verifyGiftCard(code) {
  try {
    const config = getConfig();

    if (config.testMode) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return simulateVerifyResponse(code);
    }

    const timestamp = Date.now();
    const queryParams = `referenceNo=${encodeURIComponent(code)}&timestamp=${timestamp}`;
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
        error: data.msg || "Verification failed",
        code: data.code?.toString(),
      };
    }

    return {
      success: true,
      data: {
        valid: data.data?.valid || false,
        token: data.data?.token || "",
        amount: data.data?.amount || "0",
        referenceNo: data.data?.referenceNo,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export async function redeemGiftCard(code) {
  try {
    const config = getConfig();

    if (config.testMode) {
      await new Promise((resolve) => setTimeout(resolve, 500));
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
        error: data.msg || "Redemption failed",
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
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

export const BINANCE_ERROR_CODES = {
  "000001": "System error",
  "000002": "Invalid gift card code",
  "000003": "Gift card has already been redeemed",
  "000004": "Gift card has expired",
  "000005": "Gift card is not available",
  "000006": "Gift card region restriction",
  "000007": "Account verification required",
  "000008": "Daily redemption limit reached",
  "000009": "Gift card balance insufficient",
  "000018": "Invalid gift card code format",
};

export function getErrorMessage(code) {
  if (!code) return "Unknown error";
  return BINANCE_ERROR_CODES[code] || `Error code: ${code}`;
}
