"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Role,
  RoleIdentity,
  getOrCreateIdentity,
  exportIdentityBundle,
  importIdentityBundle,
} from "@/lib/identity";
import { getZcashAdapter } from "@/lib/zcash";
import {
  ShieldIcon,
  RefreshCwIcon,
  CopyIcon,
  ExternalLinkIcon,
  KeyIcon,
  XIcon,
  UserIcon,
  StethoscopeIcon,
  BuildingIcon,
  ActivityIcon,
  CheckIcon,
} from "./Icons";

export function TopBar({
  onToggleInspector,
  isInspectorOpen,
}: {
  onToggleInspector?: () => void;
  isInspectorOpen?: boolean;
}) {
  const pathname = usePathname() || "";
  const [currentRole, setCurrentRole] = useState<Role>("patient");
  const [identity, setIdentity] = useState<RoleIdentity | null>(null);
  const [isFunding, setIsFunding] = useState(false);
  const [fundMessage, setFundMessage] = useState<string | null>(null);
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [zcashMode, setZcashMode] = useState<string>("MANUAL");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Determine current active role from route or default
  useEffect(() => {
    const current = pathname || "/";
    let activeRole: Role = "patient";
    if (current.startsWith("/provider")) activeRole = "provider";
    else if (current.startsWith("/insurer")) activeRole = "insurer";
    setCurrentRole(activeRole);

    getOrCreateIdentity(activeRole).then((id) => setIdentity(id));

    // Check Zcash adapter mode
    const adapter = getZcashAdapter();
    setZcashMode(adapter.mode.toUpperCase());
  }, [pathname]);

  const handleFund = async () => {
    if (!identity) return;
    setIsFunding(true);
    setFundMessage(null);

    try {
      const res = await fetch("/api/fund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: identity.address }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFundMessage(data.error || "Funding request failed.");
      } else {
        setFundMessage(`Funded +${data.amount} ETH! Tx: ${data.txHash.slice(0, 10)}...`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setFundMessage(`Funding error: ${message}`);
    } finally {
      setIsFunding(false);
      setTimeout(() => setFundMessage(null), 5000);
    }
  };

  const handleCopyBundle = () => {
    const bundle = exportIdentityBundle();
    navigator.clipboard.writeText(bundle);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handleImportBundle = () => {
    if (!importJson.trim()) return;
    const res = importIdentityBundle(importJson.trim());
    if (res.success) {
      alert(`Imported identities: ${res.importedRoles.join(", ")}`);
      getOrCreateIdentity(currentRole).then((id) => setIdentity(id));
      setShowIdentityModal(false);
    } else {
      alert(`Import failed: ${res.error}`);
    }
  };

  const shortenAddress = (addr: string) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Connecting...";

  const safePath = pathname || "/";

  const navLinks = [
    { href: "/patient", label: "Patient", icon: UserIcon },
    { href: "/provider", label: "Provider", icon: StethoscopeIcon },
    { href: "/insurer", label: "Insurer", icon: BuildingIcon },
    { href: "/audit", label: "Audit & Verify", icon: ActivityIcon },
    { href: "/admin", label: "Admin", icon: ShieldIcon },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/90 backdrop-blur-md transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-primary-subtle border border-primary/40 flex items-center justify-center text-primary group-hover:shadow-glowGold transition-all duration-200">
                <ShieldIcon className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="font-heading font-bold text-lg text-veil-text tracking-wide leading-none">
                  Veil<span className="text-primary">Health</span>
                </span>
                <span className="text-[10px] text-veil-muted tracking-wider uppercase font-mono mt-0.5">
                  Privacy Core
                </span>
              </div>
            </Link>

            {/* Navigation links (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((item) => {
                const isActive = safePath === item.href || (item.href !== "/" && safePath.startsWith(item.href));
                const IconComponent = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 ${
                      isActive
                        ? "bg-surface text-primary border border-primary/30 shadow-sm"
                        : "text-veil-muted hover:text-veil-text hover:bg-card/50"
                    }`}
                  >
                    <IconComponent className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-veil-muted"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2.5">
            {/* Network Badge */}
            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-surface border border-border text-veil-muted hover:text-veil-text transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              Base Sepolia
              <ExternalLinkIcon className="w-3 h-3 ml-0.5 opacity-60" />
            </a>

            {/* Zcash Shielded Status Badge */}
            <div
              className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono border ${
                zcashMode === "LIVE"
                  ? "bg-green-950/40 border-green-700/50 text-green-400"
                  : zcashMode === "MANUAL"
                  ? "bg-primary-subtle border-primary/40 text-primary"
                  : "bg-purple-950/40 border-purple-700/50 text-purple-300"
              }`}
              title="Zcash Shielded Mode (Section 11)"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  zcashMode === "LIVE"
                    ? "bg-green-400"
                    : zcashMode === "MANUAL"
                    ? "bg-primary animate-pulse"
                    : "bg-purple-400"
                }`}
              />
              Zcash: {zcashMode}
            </div>

            {/* Privacy Inspector Toggle */}
            {onToggleInspector && (
              <button
                type="button"
                onClick={onToggleInspector}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all duration-200 cursor-pointer ${
                  isInspectorOpen
                    ? "bg-accent text-white border-accent shadow-glowPurple"
                    : "bg-surface border-border text-veil-muted hover:text-veil-text hover:border-borderLight"
                }`}
                title="Inspect real-time zero-knowledge and client-side encryption metadata"
              >
                <KeyIcon className="w-3.5 h-3.5 text-accent" />
                <span className="hidden sm:inline">Inspector</span>
              </button>
            )}

            {/* Identity & Wallet Button */}
            <button
              type="button"
              onClick={() => setShowIdentityModal(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border hover:border-borderLight text-veil-text text-xs font-mono transition-all duration-150 cursor-pointer"
            >
              <div className="w-2 h-2 rounded-full bg-veil-success" />
              <span className="capitalize font-semibold text-primary">{currentRole}</span>
              <span className="text-veil-muted hidden sm:inline">
                ({identity ? shortenAddress(identity.address) : "..."})
              </span>
            </button>

            {/* Mobile menu hamburger toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-surface border border-border text-veil-muted hover:text-veil-text"
              aria-label="Toggle navigation menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={mobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-border bg-background/95 px-4 py-3 space-y-1">
            {navLinks.map((item) => {
              const isActive = safePath === item.href || (item.href !== "/" && safePath.startsWith(item.href));
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface text-primary border border-primary/30"
                      : "text-veil-muted hover:text-veil-text hover:bg-card/40"
                  }`}
                >
                  <IconComponent className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </header>

      {/* Identity / Wallet Modal */}
      {showIdentityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary">
                  <KeyIcon className="w-4 h-4" />
                </div>
                <h3 className="font-heading font-semibold text-base text-veil-text">
                  Role Identity &amp; Key Vault
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowIdentityModal(false)}
                className="p-1 rounded-lg text-veil-muted hover:text-veil-text hover:bg-card transition-colors cursor-pointer"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Active Identity Details */}
            {identity && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-card border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase font-mono text-veil-muted tracking-wider">
                      Active Role Wallet
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-primary-subtle text-primary border border-primary/30 capitalize">
                      {identity.role}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-veil-muted font-mono">Ethereum / Base Address</label>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-background border border-border text-xs font-mono text-veil-text select-all">
                      <span className="truncate pr-2">{identity.address}</span>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(identity.address)}
                        className="text-veil-muted hover:text-primary transition-colors cursor-pointer"
                        title="Copy Address"
                      >
                        <CopyIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] text-veil-muted font-mono">ECDH P-256 Public Key (JWK)</label>
                    <div className="p-2 rounded-lg bg-background border border-border text-[11px] font-mono text-veil-muted truncate select-all">
                      {JSON.stringify(identity.publicKeyJwk)}
                    </div>
                  </div>
                </div>

                {/* Test Faucet */}
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-card/60 border border-border">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium text-veil-text">Testnet Gas Faucet</div>
                    <div className="text-[11px] text-veil-muted">
                      Request 0.05 Base Sepolia ETH to sign transactions
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFund}
                    disabled={isFunding}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-black text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCwIcon className={`w-3.5 h-3.5 ${isFunding ? "animate-spin" : ""}`} />
                    <span>{isFunding ? "Sending..." : "Top Up"}</span>
                  </button>
                </div>

                {fundMessage && (
                  <div className="p-2.5 rounded-lg text-xs font-mono bg-blue-950/40 border border-blue-800 text-blue-300">
                    {fundMessage}
                  </div>
                )}

                {/* Export & Import Identity Bundle */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-veil-text">Backup &amp; Sync Identities</span>
                    <button
                      type="button"
                      onClick={handleCopyBundle}
                      className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-secondary font-medium transition-colors cursor-pointer"
                    >
                      {copySuccess ? <CheckIcon className="w-3.5 h-3.5" /> : <CopyIcon className="w-3.5 h-3.5" />}
                      <span>{copySuccess ? "Copied!" : "Export All Keys (JSON)"}</span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste exported JSON bundle to restore..."
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs text-veil-text placeholder:text-veil-muted/50 focus:border-primary focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleImportBundle}
                      className="px-3 py-2 rounded-lg bg-card border border-border hover:border-borderLight text-xs font-medium text-veil-text transition-colors cursor-pointer"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
