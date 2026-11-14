"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldIcon,
  LockIcon,
  KeyIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  CheckCircleIcon,
  UserIcon,
  StethoscopeIcon,
  BuildingIcon,
  ActivityIcon,
  ZapIcon,
} from "@/components/Icons";

export default function HomePage() {
  const roleCards = [
    {
      title: "Patient Vault",
      role: "Patient",
      href: "/patient",
      icon: UserIcon,
      accentColor: "border-primary/40 hover:border-primary text-primary",
      glowColor: "group-hover:shadow-glowGold",
      badgeText: "Self-Sovereign Device Key",
      description:
        "Retain absolute ownership of your medical records. Share with doctors for custom timeframes (e.g. 1 hour), pay clinics in 1-click private demo, and submit claims without revealing diagnosis.",
      features: [
        "Unlock & view records safely on your device",
        "Share with doctor with auto-revoking countdown",
        "1-Click private demo payments with zero bank tracking",
        "Transparent access audit log",
      ],
      cta: "Launch Patient Vault",
    },
    {
      title: "Provider Portal",
      role: "Clinic / Doctor",
      href: "/provider",
      icon: StethoscopeIcon,
      accentColor: "border-blue-500/40 hover:border-blue-400 text-blue-400",
      glowColor: "group-hover:shadow-[0_0_20px_-3px_rgba(59,130,246,0.3)]",
      badgeText: "Verified Medical Receipts",
      description:
        "Save private clinical visit notes directly to the patient's device, sign verified receipts for insurance coverage, and create private consultation bills.",
      features: [
        "Save private visit notes with local encryption",
        "Sign verified medical receipts (Attestations)",
        "Permanent doctor access to created records",
        "Create private consultation bills",
      ],
      cta: "Open Provider Portal",
    },
    {
      title: "Insurer Portal",
      role: "Insurance Underwriter",
      href: "/insurer",
      icon: BuildingIcon,
      accentColor: "border-accent/40 hover:border-accent text-accent",
      glowColor: "group-hover:shadow-glowPurple",
      badgeText: "Zero Medical Disclosure",
      description:
        "Adjudicate claims with cryptographic certainty while respecting patient privacy. Verify doctor signatures and send private claim payouts directly to patients.",
      features: [
        "Data minimization: zero medical diagnosis seen",
        "Test live 403 Forbidden access barrier",
        "Configurable policy limits & coverage categories",
        "Send private claim payouts with verifiable memos",
      ],
      cta: "Enter Insurer Portal",
    },
    {
      title: "Audit & Transparency",
      role: "Security & Verification",
      href: "/audit",
      icon: ActivityIcon,
      accentColor: "border-emerald-500/40 hover:border-emerald-400 text-emerald-400",
      glowColor: "group-hover:shadow-[0_0_20px_-3px_rgba(16,185,129,0.3)]",
      badgeText: "Live On-Chain State",
      description:
        "Examine the cryptographic architecture, live HealthVault event logs on Base Sepolia, and verify why no medical data ever touches a server unencrypted.",
      features: [
        "WebCrypto AES-GCM & ECDH specifications",
        "HealthVault smart contract audit trail",
        "Cryptographic honesty check (real vs roadmap)",
        "Live on-chain event stream",
      ],
      cta: "Inspect Security Proofs",
    },
  ];

  const stats = [
    { label: "Encryption Standard", value: "AES-GCM 256", sub: "WebCrypto in Browser" },
    { label: "Smart Contract", value: "HealthVault.sol", sub: "Base Sepolia Testnet" },
    { label: "Private Settlement", value: "Shielded Zcash", sub: "Encrypted Memos" },
    { label: "Server Knowledge", value: "0% Plaintext", sub: "Zero-Knowledge Storage" },
  ];

  return (
    <div className="space-y-20 py-6 sm:py-12 animate-in fade-in">
      {/* 1. Hero Section (Trust & Authority) */}
      <div className="text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-primary-subtle border border-primary/40 text-primary shadow-subtle">
          <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span>Privacy-Preserving Healthcare &amp; Claims Protocol</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-heading font-extrabold text-veil-text tracking-tight leading-tight">
          Your health. <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-yellow-400 to-amber-500">
            Your key.
          </span>
        </h1>

        <p className="text-base sm:text-lg text-veil-muted max-w-2xl mx-auto leading-relaxed">
          Pay for care privately, share medical records for custom time durations,
          and settle insurance claims without exposing your diagnosis or medical history.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-3">
          <Link
            href="/patient"
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-black font-bold text-sm transition-all shadow-glowGold cursor-pointer"
          >
            <span>Launch Patient Vault</span>
            <ArrowRightIcon className="w-4 h-4" />
          </Link>
          <Link
            href="/audit"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-card border border-border hover:border-borderLight text-veil-text text-sm font-medium transition-colors cursor-pointer"
          >
            <ActivityIcon className="w-4 h-4 text-primary" />
            <span>Verify Security Model</span>
          </Link>
          <a
            href="https://github.com/danielosita508/veil-health"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-surface border border-border hover:border-borderLight text-veil-muted hover:text-veil-text text-sm font-mono transition-colors cursor-pointer"
          >
            <span>GitHub</span>
            <ExternalLinkIcon className="w-3.5 h-3.5 opacity-70" />
          </a>
        </div>
      </div>

      {/* 2. Proof & Statistics Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="p-5 rounded-2xl bg-card border border-border text-center space-y-1 shadow-subtle hover:border-borderLight transition-all"
          >
            <div className="text-xl sm:text-2xl font-heading font-bold text-primary">
              {stat.value}
            </div>
            <div className="text-xs font-semibold text-veil-text">{stat.label}</div>
            <div className="text-[11px] text-veil-muted font-mono">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* 3. Role Portals Grid */}
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-veil-text">
            Choose Your Portal
          </h2>
          <p className="text-xs sm:text-sm text-veil-muted">
            Veil Health connects patients, providers, and insurers with zero trust boundaries.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roleCards.map((card) => {
            const IconComp = card.icon;
            return (
              <div
                key={card.title}
                className={`group p-7 rounded-2xl bg-card border ${card.accentColor} transition-all duration-200 flex flex-col justify-between space-y-6 ${card.glowColor}`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-surface border border-border flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-heading font-bold text-lg text-veil-text">
                          {card.title}
                        </h3>
                        <span className="text-xs text-veil-muted font-mono">{card.role}</span>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-surface border border-border text-veil-muted">
                      {card.badgeText}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-veil-muted leading-relaxed">
                    {card.description}
                  </p>

                  <ul className="space-y-2 pt-2 border-t border-border/50">
                    {card.features.map((feat, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-xs text-veil-text">
                        <CheckCircleIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href={card.href}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-surface hover:bg-surface/80 border border-border group-hover:border-primary/40 text-xs font-semibold text-veil-text transition-colors cursor-pointer"
                >
                  <span>{card.cta}</span>
                  <ArrowRightIcon className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. How Privacy Works (3-Step Diagram) */}
      <div className="p-8 sm:p-12 rounded-3xl bg-surface border border-border max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-heading font-bold text-veil-text">
            How Veil Health Protects Medical Privacy
          </h2>
          <p className="text-xs sm:text-sm text-veil-muted max-w-xl mx-auto">
            Traditional healthcare platforms require you to expose sensitive data to prove a fact. Veil Health removes that tradeoff.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary">
              <LockIcon className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-veil-text">
              1. Encrypt at the Source
            </h3>
            <p className="text-xs text-veil-muted leading-relaxed">
              Records are encrypted in your browser using random AES-GCM 256 keys. Only ciphertext and IVs leave the client.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary">
              <KeyIcon className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-veil-text">
              2. Scoped Key Wrapping
            </h3>
            <p className="text-xs text-veil-muted leading-relaxed">
              Grant a doctor access for a limited time (e.g. 1 hour). Ephemeral ECDH keypairs wrap keys per recipient, with on-chain revocation.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <div className="w-10 h-10 rounded-xl bg-primary-subtle border border-primary/30 flex items-center justify-center text-primary">
              <ZapIcon className="w-5 h-5" />
            </div>
            <h3 className="font-heading font-semibold text-sm text-veil-text">
              3. Private Settlement
            </h3>
            <p className="text-xs text-veil-muted leading-relaxed">
              Shielded Zcash payments hide who paid which clinic. Encrypted memos reconcile visits and claim payouts without financial surveillance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
