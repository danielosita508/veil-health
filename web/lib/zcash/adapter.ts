/**
 * Veil Health Zcash Adapter Interface
 * Strictly conforms to Section 11 of PROJECT.md.
 */

export type ZcashMode = "live" | "manual" | "sim";

export interface ReceivedNote {
  txid: string;
  zec: string;
  memo: string;
  time: number;
}

export interface ZcashAdapter {
  mode: ZcashMode;
  init(): Promise<void>;
  getAddress(): Promise<string>; // shielded unified address
  getBalance(): Promise<{ zec: string }>;
  send(to: string, zec: string, memo: string): Promise<{ txid: string }>;
  listReceived(): Promise<Array<ReceivedNote>>;
}
