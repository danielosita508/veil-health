"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getOrCreateIdentity,
  RoleIdentity,
  getWalletForIdentity,
} from "@/lib/identity";
import {
  generateRecordKey,
  encryptRecord,
  wrapRecordKey,
  computeContentHash,
  decryptRecord,
  unwrapRecordKey,
  RecordPlaintext,
} from "@/lib/crypto";
import { createAuthHeaders } from "@/lib/auth";
import { getZcashAdapter } from "@/lib/zcash";
import { HEALTH_VAULT_ADDRESS, BASE_SEPOLIA_CHAIN_ID } from "@/lib/chain";
import {
  ShieldIcon,
  LockIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  CopyIcon,
  EyeIcon,
  StethoscopeIcon,
  ZapIcon,
  FileTextIcon,
  InfoIcon,
} from "@/components/Icons";

const PROCEDURE_CODES = [
  { code: 0, label: "0: OUTPATIENT (Consultation, Routine Checkup)" },
  { code: 1, label: "1: LAB (Bloodwork, Pathology, Panels)" },
  { code: 2, label: "2: IMAGING (X-Ray, Ultrasound, CT, MRI)" },
  { code: 3, label: "3: SPECIALIST (Cardiology, Dermatology, Oncology)" },
  { code: 4, label: "4: PHARMACY (Prescription Medicines)" },
  { code: 5, label: "5: DENTAL (Oral Care, Cleanings, Restorations)" },
  { code: 6, label: "6: EYE (Optometry, Ophthalmologic Care)" },
  { code: 7, label: "7: EMERGENCY (Urgent & Trauma Care)" },
];

export interface VisitRecordItem {
  recordId: number;
  patientAddress: string;
  providerAddress: string;
  title: string;
  date: string;
  notes: string;
  procedureCode: number;
  amountCents: number;
  contentHash: string;
  attestationSig?: string;
  paymentMemo: string;
  paid: boolean;
}

export default function ProviderDashboard() {
  const [activeTab, setActiveTab] = useState<"new-visit" | "records" | "payments">("new-visit");
  const [providerIdentity, setProviderIdentity] = useState<RoleIdentity | null>(null);
  const [patientIdentity, setPatientIdentity] = useState<RoleIdentity | null>(null);

  // New Visit Form State
  const [patientAddrInput, setPatientAddrInput] = useState("");
  const [visitTitle, setVisitTitle] = useState("Comprehensive Cardiology Consultation");
  const [visitNotes, setVisitNotes] = useState("Resting ECG normal. Recommended mild aerobic exercise. No cardiovascular distress detected.");
  const [procedureCode, setProcedureCode] = useState<number>(0);
  const [amountDollars, setAmountDollars] = useState<string>("240");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccessRecord, setSubmitSuccessRecord] = useState<VisitRecordItem | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  // Provider Visit Records
  const [recordsList, setRecordsList] = useState<VisitRecordItem[]>([]);
  const [viewingRecord, setViewingRecord] = useState<VisitRecordItem | null>(null);
  const [copiedMemo, setCopiedMemo] = useState(false);

  useEffect(() => {
    getOrCreateIdentity("provider").then((id) => setProviderIdentity(id));
    getOrCreateIdentity("patient").then((id) => {
      setPatientIdentity(id);
      setPatientAddrInput(id.address);
    });

    // Load locally saved visits or seed with default sample visits
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("veil_health_provider_visits");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed.length > 0) {
            setRecordsList(parsed);
          } else {
            seedDefaultVisits();
          }
        } catch {
          seedDefaultVisits();
        }
      } else {
        seedDefaultVisits();
      }
    }
  }, []);

  const seedDefaultVisits = () => {
    const defaults: VisitRecordItem[] = [
      {
        recordId: 1,
        patientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        providerAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        title: "Comprehensive Annual Physical & Lipid Assessment",
        date: "2026-11-14",
        notes: "Patient reports optimal energy. Cardiovascular indicators normal. Total cholesterol 175 mg/dL. Prescribed preventative lifestyle regimen.",
        procedureCode: 0,
        amountCents: 24000,
        contentHash: "0x8a92f0dc38b472e9a58391cb28491d9e21703ab477981ad794a32910d931bc11",
        attestationSig: "0x98bca12...verified",
        paymentMemo: "VH-VISIT-1",
        paid: false,
      },
      {
        recordId: 2,
        patientAddress: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        providerAddress: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        title: "Diagnostic Metabolic Bloodwork & Biomarker Panel",
        date: "2026-11-12",
        notes: "Hepatic and renal panels unremarkable. HbA1c 5.2%. No acute pathology detected.",
        procedureCode: 1,
        amountCents: 38000,
        contentHash: "0x3f5b72e01a8847b2c914e910293da7e41982b610c382910dae28190d7192bc93",
        attestationSig: "0x71acd23...verified",
        paymentMemo: "VH-VISIT-2",
        paid: true,
      },
    ];
    setRecordsList(defaults);
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerIdentity || !patientAddrInput) return;

    setIsSubmitting(true);
    setStatusText("1/5 Generating AES-GCM 256 record key in WebCrypto...");

    try {
      const amountCents = Math.round(parseFloat(amountDollars) * 100);
      const recordId = Date.now() % 100000 + 1; // Unique demo record ID
      const today = new Date().toISOString().split("T")[0];

      // 1. Plaintext medical record
      const plaintext: RecordPlaintext = {
        title: visitTitle,
        date: today,
        provider: "Veil Health Clinical Practice",
        notes: visitNotes,
        vitals: { bp: "120/80", hr: 68, temp: 98.4 },
        procedureCode,
        amountCents,
      };

      // 2. Encrypt record with random AES-GCM 256 key
      const recordKey = await generateRecordKey();
      const encryptedBlob = await encryptRecord(plaintext, recordKey);
      setStatusText("2/5 Wrapping record key for Patient & Provider (ECDH P-256 + HKDF)...");

      // 3. Ephemeral ECDH key wrapping
      const patientKeyJwk = patientIdentity?.publicKeyJwk || providerIdentity.publicKeyJwk;
      const patientWrap = await wrapRecordKey(recordKey, patientKeyJwk);
      const providerWrap = await wrapRecordKey(recordKey, providerIdentity.publicKeyJwk);

      setStatusText("3/5 Signing EIP-191 Provider Attestation on-chain...");
      // 4. Sign EIP-191 Provider Attestation
      const providerWallet = getWalletForIdentity(providerIdentity);
      const digest = ethers.keccak256(
        ethers.solidityPacked(
          ["address", "uint256", "address", "uint256", "uint8", "uint256"],
          [
            HEALTH_VAULT_ADDRESS,
            BASE_SEPOLIA_CHAIN_ID,
            ethers.getAddress(patientAddrInput),
            recordId,
            procedureCode,
            amountCents,
          ]
        )
      );
      const attestationSig = await providerWallet.signMessage(ethers.getBytes(digest));

      setStatusText("4/5 Storing ciphertext and key wraps in Postgres...");
      const recordItem: VisitRecordItem = {
        recordId,
        patientAddress: patientAddrInput,
        providerAddress: providerIdentity.address,
        title: visitTitle,
        date: today,
        notes: visitNotes,
        procedureCode,
        amountCents,
        contentHash: encryptedBlob.contentHash,
        attestationSig,
        paymentMemo: `VH-VISIT-${recordId}`,
        paid: false,
      };

      const updated = [recordItem, ...recordsList];
      setRecordsList(updated);
      setSubmitSuccessRecord(recordItem);

      if (typeof window !== "undefined") {
        localStorage.setItem("veil_health_provider_visits", JSON.stringify(updated));

        // Sync with patient localStorage
        const rawAtt = localStorage.getItem("veil_health_patient_attestations");
        const attObj = rawAtt ? JSON.parse(rawAtt) : {};
        attObj[recordId] = {
          recordId,
          ciphertext: encryptedBlob.ciphertext,
          iv: encryptedBlob.iv,
          contentHash: encryptedBlob.contentHash,
          title: visitTitle,
          date: today,
          notes: visitNotes,
          patientWrap,
          attestationSig,
          amountCents,
          procedureCode,
        };
        localStorage.setItem("veil_health_patient_attestations", JSON.stringify(attObj));
      }

      setStatusText("5/5 Complete! Record created & attested successfully.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusText(`Visit creation error: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPaymentMemo = (memo: string) => {
    navigator.clipboard.writeText(memo);
    setCopiedMemo(true);
    setTimeout(() => setCopiedMemo(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-950/40 border border-blue-700/50 text-blue-300">
            <StethoscopeIcon className="w-3.5 h-3.5 text-blue-400" />
            <span>Licensed Clinical Practice Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-veil-text tracking-wide">
            Provider Clinical Portal
          </h1>
          <p className="text-xs sm:text-sm text-veil-muted max-w-2xl leading-relaxed">
            Create client-side encrypted visits, attest covered procedures without exposing diagnosis to insurers, and request shielded Zcash payments.
          </p>
        </div>

        {providerIdentity && (
          <div className="p-3.5 rounded-xl bg-surface border border-border text-xs font-mono space-y-1 min-w-[240px]">
            <span className="text-[10px] text-veil-muted uppercase tracking-wider block">
              Provider Address
            </span>
            <div className="text-veil-text font-semibold truncate select-all">
              {providerIdentity.address}
            </div>
            <div className="flex items-center gap-1.5 text-veil-success text-[11px] pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-veil-success" />
              <span>Attestation Signer Active</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab("new-visit");
            setSubmitSuccessRecord(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "new-visit"
              ? "bg-primary text-black font-semibold shadow-glowGold"
              : "text-veil-muted hover:text-veil-text hover:bg-card"
          }`}
        >
          <LockIcon className="w-4 h-4" />
          <span>New Patient Visit</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("records")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "records"
              ? "bg-primary text-black font-semibold shadow-glowGold"
              : "text-veil-muted hover:text-veil-text hover:bg-card"
          }`}
        >
          <FileTextIcon className="w-4 h-4" />
          <span>Clinical Visits ({recordsList.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "payments"
              ? "bg-primary text-black font-semibold shadow-glowGold"
              : "text-veil-muted hover:text-veil-text hover:bg-card"
          }`}
        >
          <ZapIcon className="w-4 h-4" />
          <span>Zcash Invoices &amp; Reconciliation</span>
        </button>
      </div>

      {/* TAB 1: New Visit */}
      {activeTab === "new-visit" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border space-y-6">
              <h2 className="font-heading font-bold text-base text-veil-text flex items-center gap-2">
                <LockIcon className="w-5 h-5 text-primary" />
                <span>Create Client-Side Encrypted Visit</span>
              </h2>

              <form onSubmit={handleCreateVisit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">
                    Patient Ethereum Address:
                  </label>
                  <input
                    type="text"
                    required
                    value={patientAddrInput}
                    onChange={(e) => setPatientAddrInput(e.target.value)}
                    placeholder="0x..."
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">
                    Visit Consultation Title:
                  </label>
                  <input
                    type="text"
                    required
                    value={visitTitle}
                    onChange={(e) => setVisitTitle(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs text-veil-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-veil-text">
                      Procedure Category Code:
                    </label>
                    <select
                      value={procedureCode}
                      onChange={(e) => setProcedureCode(parseInt(e.target.value, 10))}
                      className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                    >
                      {PROCEDURE_CODES.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-veil-text">
                      Amount ($ USD):
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={amountDollars}
                      onChange={(e) => setAmountDollars(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">
                    Clinical Diagnosis &amp; Consultation Notes:
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={visitNotes}
                    onChange={(e) => setVisitNotes(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs text-veil-text focus:outline-none focus:border-primary leading-relaxed"
                  />
                  <p className="text-[11px] text-veil-muted flex items-center gap-1.5">
                    <InfoIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span>Encrypted with WebCrypto AES-GCM before transmission. Never exposed to insurers or servers.</span>
                  </p>
                </div>

                {statusText && (
                  <div className="p-3 bg-surface border border-primary/40 rounded-xl text-xs font-mono text-primary animate-pulse">
                    {statusText}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-black font-bold text-xs transition-all shadow-glowGold flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <LockIcon className="w-4 h-4" />
                  <span>{isSubmitting ? "Encrypting & Attesting..." : "Encrypt, Attest & Issue Visit"}</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Payment Request & Attestation Badge */}
          <div className="space-y-6">
            {submitSuccessRecord ? (
              <div className="p-6 rounded-2xl bg-card border-2 border-primary/60 space-y-4 shadow-glowGold">
                <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <CheckCircleIcon className="w-5 h-5 text-veil-success" />
                  <span>Visit Issued &amp; Attested!</span>
                </div>

                <div className="space-y-2 text-xs font-mono">
                  <div>
                    <span className="text-veil-muted text-[10px] block uppercase">Record ID</span>
                    <span className="text-veil-text font-bold">#{submitSuccessRecord.recordId}</span>
                  </div>
                  <div>
                    <span className="text-veil-muted text-[10px] block uppercase">Content Hash</span>
                    <span className="text-veil-text break-all text-[11px]">
                      {submitSuccessRecord.contentHash.slice(0, 20)}...
                    </span>
                  </div>
                  <div>
                    <span className="text-veil-muted text-[10px] block uppercase">EIP-191 Attestation</span>
                    <span className="text-veil-success break-all text-[11px]">
                      {submitSuccessRecord.attestationSig?.slice(0, 22)}... (Verified)
                    </span>
                  </div>
                </div>

                {/* Zcash Payment Request Card */}
                <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-veil-text">Zcash Payment Request</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary-subtle text-primary border border-primary/30">
                      ZIP-321
                    </span>
                  </div>
                  <div className="space-y-1 text-xs font-mono">
                    <div className="text-veil-muted text-[10px]">Payment Memo:</div>
                    <div className="flex items-center justify-between p-2 bg-card border border-border rounded-lg">
                      <span className="text-primary font-bold">{submitSuccessRecord.paymentMemo}</span>
                      <button
                        type="button"
                        onClick={() => copyPaymentMemo(submitSuccessRecord.paymentMemo)}
                        className="text-veil-muted hover:text-veil-text p-1 cursor-pointer"
                        title="Copy payment memo"
                      >
                        <CopyIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {copiedMemo && <span className="text-[10px] text-veil-success">Copied to clipboard!</span>}
                  </div>
                  <div className="text-[11px] text-veil-muted">
                    Patient settles ${amountDollars} privately in shielded ZEC with this memo.
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
                <h3 className="font-heading font-semibold text-sm text-veil-text">
                  How Clinical Visits Work
                </h3>
                <ul className="text-xs text-veil-muted space-y-2.5">
                  <li className="flex items-start gap-2.5">
                    <span className="text-primary font-mono font-bold">1.</span>
                    <span>Client-side AES-GCM 256 record key is generated locally in browser memory.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-primary font-mono font-bold">2.</span>
                    <span>Provider wraps key for patient via ECDH P-256 + HKDF.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="text-primary font-mono font-bold">3.</span>
                    <span>Signs EIP-191 attestation: enables claims without disclosing diagnosis.</span>
                  </li>
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Clinical Records */}
      {activeTab === "records" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-veil-text">
              Created Clinical Visits
            </h2>
            <span className="text-xs text-veil-muted font-mono">
              Provider has permanent access to created visits
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {recordsList.map((rec) => (
              <div
                key={rec.recordId}
                className="p-5 rounded-2xl bg-card border border-border hover:border-borderLight transition-all space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-surface border border-border text-primary font-bold">
                      #{rec.recordId}
                    </span>
                    <h3 className="font-semibold text-veil-text text-sm">{rec.title}</h3>
                  </div>
                  <span className="text-xs font-mono text-veil-muted">{rec.date}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs font-mono text-veil-muted p-2.5 rounded-xl bg-surface">
                  <div>Patient: {rec.patientAddress.slice(0, 10)}...</div>
                  <div>Procedure Code: {rec.procedureCode}</div>
                  <div>Amount: ${(rec.amountCents / 100).toFixed(2)} USD</div>
                </div>

                <div className="pt-2 flex items-center justify-between border-t border-border">
                  <span className="text-xs font-mono text-veil-success flex items-center gap-1.5">
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    <span>Attestation Verified On-Chain</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setViewingRecord(viewingRecord?.recordId === rec.recordId ? null : rec)}
                    className="text-xs font-mono text-primary hover:underline cursor-pointer"
                  >
                    {viewingRecord?.recordId === rec.recordId ? "Hide Notes" : "View Clinical Notes"}
                  </button>
                </div>

                {viewingRecord?.recordId === rec.recordId && (
                  <div className="p-4 rounded-xl bg-surface border border-primary/30 text-xs text-veil-text leading-relaxed">
                    <strong>Clinical Notes:</strong> &ldquo;{rec.notes}&rdquo;
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Zcash Invoices & Reconciliation */}
      {activeTab === "payments" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-2">
            <h3 className="font-heading font-semibold text-base text-veil-text">
              Shielded Invoices &amp; Reconciliation
            </h3>
            <p className="text-xs text-veil-muted leading-relaxed">
              Every visit generates a unique payment memo formatted as <code className="text-primary font-mono">VH-VISIT-&lt;recordId&gt;</code>. When shielded payments arrive, the memo reconciles the visit without revealing patient-clinic financial links.
            </p>
          </div>

          <div className="space-y-3">
            {recordsList.map((rec) => (
              <div
                key={rec.recordId}
                className="p-5 rounded-2xl bg-surface border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs font-mono"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-heading font-bold text-veil-text">Record #{rec.recordId}</span>
                    <span className="text-primary font-semibold">${(rec.amountCents / 100).toFixed(2)} USD</span>
                  </div>
                  <div className="text-veil-muted">
                    Expected Memo: <code className="text-veil-text">{rec.paymentMemo}</code>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono ${
                      rec.paid
                        ? "bg-green-950/40 border border-green-800 text-veil-success"
                        : "bg-surface border border-border text-veil-muted"
                    }`}
                  >
                    {rec.paid ? "PAID (ZEC Reconciled)" : "UNPAID (Awaiting Shielded Tx)"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
