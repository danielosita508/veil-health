import { ReceivedNote, ZcashAdapter } from "./adapter";

/**
 * Simulated Zcash Adapter
 * Clearly badged as SIMULATED across the UI.
 * Provides deterministic simulation of shielded transactions, balance updates,
 * and memo reconciliation.
 */
export class SimZcashAdapter implements ZcashAdapter {
  public readonly mode = "sim" as const;
  private storageKey = "veil_health_zcash_sim_notes";
  private address =
    "uregtest1simulatedshieldedaddress000000000000000000000000000000000000000000000000000000000";

  public async init(): Promise<void> {
    if (typeof window !== "undefined" && window.localStorage) {
      if (!window.localStorage.getItem(this.storageKey)) {
        window.localStorage.setItem(this.storageKey, JSON.stringify([]));
      }
    }
  }

  public async getAddress(): Promise<string> {
    return this.address;
  }

  public async getBalance(): Promise<{ zec: string }> {
    const notes = await this.listReceived();
    const total = notes.reduce(
      (acc, note) => acc + parseFloat(note.zec || "0"),
      1.5 // Initial simulated demo balance
    );
    return { zec: total.toFixed(4) };
  }

  public async send(
    to: string,
    zec: string,
    memo: string
  ): Promise<{ txid: string }> {
    const ts = Date.now();
    const txid = `sim_${Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("")}`;

    const note: ReceivedNote = {
      txid,
      zec,
      memo,
      time: Math.floor(ts / 1000),
    };

    if (typeof window !== "undefined" && window.localStorage) {
      const existing = await this.listReceived();
      existing.unshift(note);
      window.localStorage.setItem(this.storageKey, JSON.stringify(existing));
    }

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
}
