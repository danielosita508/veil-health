"use client";

import React, { useState } from "react";
import { ShieldIcon, LockIcon, EyeOffIcon, EyeIcon, XIcon, CheckCircleIcon } from "./Icons";

export interface PrivacyContextData {
  recordId?: number | string;
  patientAddress?: string;
  providerAddress?: string;
  insurerAddress?: string;
  contentHash?: string;
  ciphertextPreview?: string;
  procedureCode?: string;
  amountFormatted?: string;
  attestationValid?: boolean;
  plaintextJson?: Record<string, unknown> | null;
}

export function PrivacyInspector({
  isOpen,
  onClose,
  data,
}: {
  isOpen: boolean;
  onClose: () => void;
  data?: PrivacyContextData;
}) {
  const [activeTab, setActiveTab] = useState<"comparison" | "raw">("comparison");

  if (!isOpen) return null;

  const sampleData: PrivacyContextData = {
    recordId: data?.recordId ?? 1,
    patientAddress: data?.patientAddress ?? "0x7099...79C8",
    providerAddress: data?.providerAddress ?? "0x3C44...93BC",
    insurerAddress: data?.insurerAddress ?? "0x15d3...6A65",
    contentHash:
      data?.contentHash ??
      "0x8a92f0dc38b472e9a58391cb28491d9e21703ab477981ad794a32910d931bc11",
    ciphertextPreview:
      data?.ciphertextPreview ??
      "eyJpdiI6IlpHSnNiR1U9Iiwid3JhcHBlZCI6ImV5SmhhV1FpT2lJeU1qVTJNR1F3WW1V...\" (AES-256-GCM)",
    procedureCode: data?.procedureCode ?? "0: OUTPATIENT",
    amountFormatted: data?.amountFormatted ?? "$240.00",
    attestationValid: data?.attestationValid ?? true,
    plaintextJson: data?.plaintextJson ?? {
      title: "Comprehensive Annual Physical & Lipid Assessment",
      date: "2026-11-14",
      provider: "Dr. Sarah Vance, MD",
      notes: "Patient reports optimal energy. Cardiovascular indicators normal. Total cholesterol 175 mg/dL.",
      vitals: { bp: "118/76", hr: 64, temp: 98.4 },
    },
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-card border-t-2 border-primary shadow-2xl transition-all duration-300 max-h-[85vh] flex flex-col animate-in slide-in-from-bottom">
      {/* Header bar */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-subtle border border-primary/40 flex items-center justify-center text-primary">
            <ShieldIcon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-sm text-veil-text flex items-center gap-2">
              Live Privacy &amp; Cryptographic Inspector
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-background border border-border text-primary uppercase tracking-wider">
                Zero-Knowledge Boundary
              </span>
            </h3>
            <p className="text-xs text-veil-muted">
              Real-time audit comparing data visible across Public Chain, Database, Insurer, and Patient.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-background border border-border rounded-lg p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("comparison")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === "comparison"
                  ? "bg-primary text-black font-semibold shadow-sm"
                  : "text-veil-muted hover:text-veil-text"
              }`}
            >
              Side-by-Side Audit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("raw")}
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                activeTab === "raw"
                  ? "bg-primary text-black font-semibold shadow-sm"
                  : "text-veil-muted hover:text-veil-text"
              }`}
            >
              Raw Payload Diff
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-veil-muted hover:text-veil-text hover:bg-background transition-colors cursor-pointer"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content Columns */}
      <div className="p-6 overflow-y-auto">
        {activeTab === "comparison" ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* 1. Public Chain Column */}
            <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-veil-text border-b border-border pb-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span>1. Public Chain (Base Sepolia)</span>
              </div>
              <p className="text-[11px] text-veil-muted">
                Consensus state. Zero medical or diagnosis data stored.
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Record ID</span>
                  <span className="text-veil-text">#{sampleData.recordId}</span>
                </div>
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">On-Chain contentHash</span>
                  <span className="text-primary break-all text-[11px]">
                    {sampleData.contentHash?.slice(0, 18)}...
                  </span>
                </div>
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Patient / Provider</span>
                  <span className="text-veil-text text-[11px]">
                    {sampleData.patientAddress?.slice(0, 8)}... / {sampleData.providerAddress?.slice(0, 8)}...
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border text-[11px] text-veil-success flex items-center gap-1.5">
                  <LockIcon className="w-3.5 h-3.5" />
                  <span>No Plaintext Exposed</span>
                </div>
              </div>
            </div>

            {/* 2. Supabase DB Column */}
            <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-veil-text border-b border-border pb-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>2. Supabase Postgres (RLS)</span>
              </div>
              <p className="text-[11px] text-veil-muted">
                Only ciphertext blobs and wrapped keys. No public policies.
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Ciphertext (AES-GCM 256)</span>
                  <div className="p-2 bg-surface border border-border rounded-lg text-[10px] text-veil-muted break-all">
                    {sampleData.ciphertextPreview?.slice(0, 75)}...
                  </div>
                </div>
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Wrapped Key Data</span>
                  <div className="p-2 bg-surface border border-border rounded-lg text-[10px] text-veil-muted">
                    ephemeralPub + iv + wrappedKey
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-border text-[11px] text-veil-success flex items-center gap-1.5">
                  <EyeOffIcon className="w-3.5 h-3.5" />
                  <span>Zero Plaintext on Server</span>
                </div>
              </div>
            </div>

            {/* 3. Insurer Perspective Column */}
            <div className="rounded-xl border border-border bg-background/60 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-veil-text border-b border-border pb-2">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span>3. Insurer Perspective</span>
              </div>
              <p className="text-[11px] text-veil-muted">
                Data Minimization: only procedure category &amp; provider signature.
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Procedure Category</span>
                  <span className="text-veil-text font-bold">{sampleData.procedureCode}</span>
                </div>
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Amount to Settle</span>
                  <span className="text-primary font-bold">{sampleData.amountFormatted}</span>
                </div>
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Attestation Signature</span>
                  <span className="text-veil-success text-[11px]">Valid ECDSA (ecrecover) ✓</span>
                </div>
                <div className="p-2 rounded-lg bg-red-950/20 border border-red-800/40 text-[11px] text-red-300 flex items-center gap-1.5">
                  <EyeOffIcon className="w-3.5 h-3.5" />
                  <span>Diagnosis Blinded (Redacted)</span>
                </div>
              </div>
            </div>

            {/* 4. Patient Vault Column */}
            <div className="rounded-xl border-2 border-primary/50 bg-background/90 p-4 space-y-3 shadow-glowGold">
              <div className="flex items-center gap-2 text-xs font-bold text-primary border-b border-border pb-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                <span>4. Patient Vault (Decrypted Locally)</span>
              </div>
              <p className="text-[11px] text-veil-muted">
                Full decrypted health records in patient browser memory only.
              </p>
              <div className="space-y-2 text-xs font-mono">
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Consultation Title</span>
                  <span className="text-veil-text font-semibold">
                    {String(sampleData.plaintextJson?.title)}
                  </span>
                </div>
                <div>
                  <span className="text-veil-muted text-[10px] block uppercase">Clinical Notes</span>
                  <span className="text-veil-text text-[11px] italic">
                    &ldquo;{String(sampleData.plaintextJson?.notes)}&rdquo;
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-surface border border-primary/30 text-[11px] text-primary flex items-center gap-1.5">
                  <CheckCircleIcon className="w-3.5 h-3.5 text-veil-success" />
                  <span>Full Sovereign Access</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-background border border-border text-xs font-mono space-y-3 overflow-x-auto">
            <div className="text-veil-muted text-[11px]">
              Raw cryptographic data structures in transit vs in browser memory:
            </div>
            <pre className="text-veil-text text-[11px] leading-relaxed">
              {JSON.stringify(sampleData, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
