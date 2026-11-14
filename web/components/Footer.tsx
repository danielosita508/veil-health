import React from "react";
import Link from "next/link";
import { ShieldIcon, ExternalLinkIcon } from "./Icons";

export function Footer() {
  return (
    <footer className="w-full border-t border-border bg-surface/60 mt-20 text-veil-muted text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary">
            <ShieldIcon className="w-4 h-4" />
          </div>
          <div>
            <div className="font-heading font-semibold text-veil-text text-sm tracking-wide">
              Veil<span className="text-primary">Health</span>
            </div>
            <div className="text-[11px] text-veil-muted">
              Privacy-first healthcare platform with client-side encryption and shielded Zcash settlement.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-[12px]">
          <Link href="/patient" className="hover:text-veil-text transition-colors">
            Patient Vault
          </Link>
          <Link href="/provider" className="hover:text-veil-text transition-colors">
            Provider Portal
          </Link>
          <Link href="/insurer" className="hover:text-veil-text transition-colors">
            Insurer Portal
          </Link>
          <Link href="/audit" className="hover:text-veil-text transition-colors">
            Audit &amp; Verify
          </Link>
          <Link href="/admin" className="hover:text-veil-text transition-colors">
            Admin
          </Link>
          <a
            href="https://github.com/danielosita508/veil-health"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-veil-text transition-colors"
          >
            GitHub
            <ExternalLinkIcon className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 pt-2 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-veil-muted/70">
        <div>
          Testnet Demo &bull; Not for diagnostic medical use &bull; WebCrypto AES-GCM 256 + ECDH P-256
        </div>
        <div className="flex items-center gap-2 font-mono">
          <span className="w-2 h-2 rounded-full bg-veil-success" />
          Base Sepolia &amp; Zcash Testnet
        </div>
      </div>
    </footer>
  );
}
