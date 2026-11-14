import { ReceivedNote, ZcashAdapter } from "./adapter";

/**
 * WebZjs Live Zcash Adapter
 * Spike evaluation result (Milestone 2, Section 11):
 * 1. The `@chainsafe/webzjs-wallet` package is not publicly available on npm registry (returns 404).
 * 2. No public hosted testnet gRPC-web lightwalletd proxy endpoint is provided without running Docker.
 *
 * This adapter encapsulates the intended WebZjs live implementation and reports
 * the spike outcome when live mode is selected.
 */
export class WebZjsAdapter implements ZcashAdapter {
  public readonly mode = "live" as const;
  private isAvailable: boolean = false;

  public async init(): Promise<void> {
    // Check if webzjs-wallet was injected or loaded in window
    if (typeof window !== "undefined" && (window as unknown as Record<string, unknown>).webzjs) {
      this.isAvailable = true;
    } else {
      this.isAvailable = false;
      throw new Error(
        "WebZjs spike failed: @chainsafe/webzjs-wallet package is not available on npm, and no hosted testnet gRPC-web lightwalletd proxy exists. Fallback to 'manual' or 'sim' mode."
      );
    }
  }

  public async getAddress(): Promise<string> {
    if (!this.isAvailable) {
      throw new Error("WebZjs not initialized.");
    }
    return "utest1livewebzjsaddressnotavailable";
  }

  public async getBalance(): Promise<{ zec: string }> {
    return { zec: "0.0000" };
  }

  public async send(
    to: string,
    zec: string,
    memo: string
  ): Promise<{ txid: string }> {
    throw new Error("WebZjs send not available. Use manual or sim mode.");
  }

  public async listReceived(): Promise<Array<ReceivedNote>> {
    return [];
  }
}
