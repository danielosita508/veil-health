import { ReceivedNote, ZcashAdapter } from "./adapter";

/**
 * Manual Zcash Adapter
 * Used when WebZjs / gRPC-web proxy is unavailable.
 * Generates ZIP-321 standard payment URIs and tracks manual testnet confirmations.
 */
export class ManualZcashAdapter implements ZcashAdapter {
  public readonly mode = "manual" as const;
  private address: string = "";
  private storageKey = "veil_health_zcash_manual_notes";
  private addressKey = "veil_health_zcash_manual_address";

  public async init(): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      let storedAddr = window.localStorage.getItem(this.addressKey);
      if (!storedAddr) {
        // Testnet unified address format template for demo/manual mode
        storedAddr =
          "utest1z7j7206jqm2jfqj543e3fux9v0u8y03x6k7y5u02a4j6t08q83c0f49r2m3q45w098e6j72";
        window.localStorage.setItem(this.addressKey, storedAddr);
      }
      this.address = storedAddr;
    } else {
      this.address =
        "utest1z7j7206jqm2jfqj543e3fux9v0u8y03x6k7y5u02a4j6t08q83c0f49r2m3q45w098e6j72";
    }
  }

  public async getAddress(): Promise<string> {
    if (!this.address) await this.init();
    return this.address;
  }

  public async getBalance(): Promise<{ zec: string }> {
    const notes = await this.listReceived();
    const total = notes.reduce((acc, note) => acc + parseFloat(note.zec || "0"), 0);
    return { zec: total.toFixed(4) };
  }

  /**
   * Generates a standard ZIP-321 payment URI:
   * zcash:<address>?amount=<zec>&memo=<base64-memo>
   */
  public buildZip321Uri(to: string, zec: string, memo: string): string {
    const memoBase64 =
      typeof Buffer !== "undefined"
        ? Buffer.from(memo, "utf8").toString("base64url")
        : btoa(memo).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    return `zcash:${to}?amount=${zec}&memo=${memoBase64}`;
  }

  public async send(
    to: string,
    zec: string,
    memo: string
  ): Promise<{ txid: string }> {
    // Generate deterministic mock testnet txid for the manual transaction request
    const ts = Date.now();
    const txid = `manual_tx_${ts.toString(16)}_${Math.random()
      .toString(16)
      .substring(2, 10)}`;

    // Store in receiver's view if on the same browser for demo continuity
    this.recordReceived({
      txid,
      zec,
      memo,
      time: Math.floor(ts / 1000),
    });

    return { txid };
  }

  public async listReceived(): Promise<Array<ReceivedNote>> {
    if (typeof window === "undefined" || !window.localStorage) {
      return [];
    }
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ReceivedNote[];
    } catch {
      return [];
    }
  }

  public recordReceived(note: ReceivedNote): void {
    if (typeof window === "undefined" || !window.localStorage) return;
    const existing = this.listReceivedSync();
    // Avoid duplicate txids
    if (!existing.some((n) => n.txid === note.txid)) {
      existing.unshift(note);
      window.localStorage.setItem(this.storageKey, JSON.stringify(existing));
    }
  }

  private listReceivedSync(): ReceivedNote[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    const raw = window.localStorage.getItem(this.storageKey);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as ReceivedNote[];
    } catch {
      return [];
    }
  }
}
