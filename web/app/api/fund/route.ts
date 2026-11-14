import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";
import { getBaseSepoliaProvider } from "@/lib/chain";

// In-memory rate limiter per lowercase address: 60-second cooldown
const fundRateLimitMap = new Map<string, number>();
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;

/**
 * POST /api/fund
 * Tops up demo burner wallets on Base Sepolia from a funded server key.
 * Only sends funds if the recipient's balance is below the configured threshold.
 * Rate-limited by address (1 request per minute).
 */
export async function POST(req: NextRequest) {
  try {
    let targetAddress: string | null = null;

    // Check request body first
    try {
      const body = await req.json();
      if (body && typeof body.address === "string") {
        targetAddress = body.address.trim();
      }
    } catch {
      // Body may be empty if caller provided x-address header
    }

    // Fall back to x-address header if not specified in body
    if (!targetAddress) {
      targetAddress = req.headers.get("x-address");
    }

    if (!targetAddress || !ethers.isAddress(targetAddress)) {
      return NextResponse.json(
        { error: "A valid recipient Ethereum address is required (in JSON body or x-address header)." },
        { status: 400 }
      );
    }

    const normalizedAddress = ethers.getAddress(targetAddress);
    const addressKey = normalizedAddress.toLowerCase();

    // Enforce rate limit (1 top-up per 60 seconds per address)
    const now = Date.now();
    const lastFundedAt = fundRateLimitMap.get(addressKey);
    if (lastFundedAt && now - lastFundedAt < RATE_LIMIT_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil(
        (RATE_LIMIT_COOLDOWN_MS - (now - lastFundedAt)) / 1000
      );
      return NextResponse.json(
        {
          error: `Rate limit exceeded. Please wait ${retryAfterSec}s before requesting funds again.`,
          retryAfter: retryAfterSec,
        },
        { status: 429 }
      );
    }

    // Server-side faucet key
    const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!faucetPrivateKey || faucetPrivateKey.trim() === "" || faucetPrivateKey.startsWith("0x0000000000000000000000000000000000000000")) {
      return NextResponse.json(
        {
          error:
            "Faucet service is unconfigured on the server (FAUCET_PRIVATE_KEY is missing or template default).",
        },
        { status: 503 }
      );
    }

    const provider = getBaseSepoliaProvider();

    // Check existing balance
    const currentBalance = await provider.getBalance(normalizedAddress);

    const thresholdStr = process.env.FUND_THRESHOLD_ETH || "0.002";
    const amountStr = process.env.FUND_AMOUNT_ETH || "0.005";

    const thresholdWei = ethers.parseEther(thresholdStr);
    const fundAmountWei = ethers.parseEther(amountStr);

    if (currentBalance >= thresholdWei) {
      return NextResponse.json(
        {
          error: "Wallet already has sufficient testnet ETH balance.",
          currentBalance: ethers.formatEther(currentBalance),
          threshold: thresholdStr,
        },
        { status: 400 }
      );
    }

    // Execute transfer
    const faucetWallet = new ethers.Wallet(faucetPrivateKey, provider);
    const tx = await faucetWallet.sendTransaction({
      to: normalizedAddress,
      value: fundAmountWei,
    });

    // Record rate limit timestamp
    fundRateLimitMap.set(addressKey, Date.now());

    return NextResponse.json({
      success: true,
      recipient: normalizedAddress,
      amount: amountStr,
      txHash: tx.hash,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Funding transaction failed: ${message}` },
      { status: 500 }
    );
  }
}

