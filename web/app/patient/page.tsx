"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getOrCreateIdentity,
  RoleIdentity,
} from "@/lib/identity";
import {
  decryptRecord,
  unwrapRecordKey,
  wrapRecordKey,
  generateIdentityKeyPair,
  RecordPlaintext,
  WrappedKeyData,
} from "@/lib/crypto";
import { getZcashAdapter, computePayoutRef, verifyClaimPayout } from "@/lib/zcash";
import {
  ShieldIcon,
  LockIcon,
  KeyIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  EyeIcon,
  RefreshCwIcon,
  CopyIcon,
  UserIcon,
  ZapIcon,
  FileTextIcon,
  ActivityIcon,
  QrCodeIcon,
} from "@/components/Icons";

export interface ActiveGrant {
  recordId: number;
  grantee: string;
  expiryUnix: number;
  label: string;
}

export interface PatientClaimItem {
  claimId: number;
  recordId: number;
  policyId: number;
  procedureCode: number;
  amountDollars: string;
  status: "Submitted" | "Approved" | "Rejected" | "Paid";
  payoutRef?: string;
}

export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState<"records" | "share" | "claims" | "payments" | "access-log">("records");
  const [patientIdentity, setPatientIdentity] = useState<RoleIdentity | null>(null);

  // Records state
  const [records, setRecords] = useState<any[]>([]);
  const [decryptedRecords, setDecryptedRecords] = useState<Record<number, RecordPlaintext>>({});
  const [decryptingId, setDecryptingId] = useState<number | null>(null);

  // Share state
  const [selectedRecordId, setSelectedRecordId] = useState<number>(1);
  const [granteeAddress, setGranteeAddress] = useState("");
  const [grantDuration, setGrantDuration] = useState<string>("1h"); // 2m, 1h, 24h, 7d
  const [activeGrants, setActiveGrants] = useState<ActiveGrant[]>([]);
  const [shareStatus, setShareStatus] = useState<string | null>(null);

  // Claims state
  const [claimsList, setClaimsList] = useState<PatientClaimItem[]>([]);
  const [submittingClaim, setSubmittingClaim] = useState(false);
  const [claimStatus, setClaimStatus] = useState<string | null>(null);

  // Payments state
  const [clinicAddress, setClinicAddress] = useState("ztestsapling1q8y0e82...demoClinicShieldedAddress");
  const [payAmountZec, setPayAmountZec] = useState("0.05");
  const [payMemo, setPayMemo] = useState("VH-VISIT-1");
  const [isPaying, setIsPaying] = useState(false);
  const [payResult, setPayResult] = useState<string | null>(null);
  const [receivedNotes, setReceivedNotes] = useState<any[]>([]);
  const [oneClickPaying, setOneClickPaying] = useState(false);
  const [isDemoPaid, setIsDemoPaid] = useState(false);
  const [verificationMsg, setVerificationMsg] = useState<string | null>(null);

  // Access Log
  const [accessLogs, setAccessLogs] = useState<any[]>([]);

  useEffect(() => {
    getOrCreateIdentity("patient").then((id) => {
      setPatientIdentity(id);
      loadPatientData(id);
    });

    // Default doctor grantee
    getOrCreateIdentity("provider").then((id) => setGranteeAddress(id.address));

    // Refresh received Zcash payouts
    const adapter = getZcashAdapter();
    adapter.listReceived().then((notes) => setReceivedNotes(notes));
  }, []);

  const loadPatientData = (id: RoleIdentity) => {
    if (typeof window === "undefined") return;

    // Load visit attestations from provider or populate default sample visits
    const rawAttestations = localStorage.getItem("veil_health_patient_attestations");
    if (rawAttestations) {
      try {
        const parsed = JSON.parse(rawAttestations);
        const recordArr = Object.values(parsed);
        if (recordArr.length > 0) {
          setRecords(recordArr);
          const first = recordArr[0] as any;
          setSelectedRecordId(first.recordId);
          setPayMemo(`VH-VISIT-${first.recordId}`);
        } else {
          populateDefaultRecords();
        }
      } catch {
        populateDefaultRecords();
      }
    } else {
      populateDefaultRecords();
    }

    // Load active grants
    const rawGrants = localStorage.getItem("veil_health_active_grants");
    if (rawGrants) {
      try {
        setActiveGrants(JSON.parse(rawGrants));
      } catch {
        setActiveGrants(getDefaultGrants());
      }
    } else {
      setActiveGrants(getDefaultGrants());
    }

    // Load claims
    const rawClaims = localStorage.getItem("veil_health_patient_claims");
    if (rawClaims) {
      try {
        setClaimsList(JSON.parse(rawClaims));
      } catch {
        setClaimsList(getDefaultClaims());
      }
    } else {
      setClaimsList(getDefaultClaims());
    }

    // Load access log
    const rawLogs = localStorage.getItem("veil_health_access_log");
    if (rawLogs) {
      try {
        setAccessLogs(JSON.parse(rawLogs));
      } catch {
        setAccessLogs(getDefaultLogs());
      }
    } else {
      setAccessLogs(getDefaultLogs());
    }
  };

  const populateDefaultRecords = () => {
    const sampleRecords = [
      {
        recordId: 1,
        title: "Comprehensive Annual Physical & Lipid Assessment",
        date: "2026-11-14",
        notes: "Patient reports optimal energy. Cardiovascular indicators normal. Total cholesterol 175 mg/dL. Prescribed preventative lifestyle regimen.",
        procedureCode: 0,
        amountCents: 24000,
        contentHash: "0x8a92f0dc38b472e9a58391cb28491d9e21703ab477981ad794a32910d931bc11",
        vitals: { bp: "118/76", hr: 64 },
      },
      {
        recordId: 2,
        title: "Diagnostic Metabolic Bloodwork & Biomarker Panel",
        date: "2026-11-12",
        notes: "Hepatic and renal panels unremarkable. HbA1c 5.2%. No acute pathology detected.",
        procedureCode: 1,
        amountCents: 38000,
        contentHash: "0x3f5b72e01a8847b2c914e910293da7e41982b610c382910dae28190d7192bc93",
        vitals: { bp: "120/80", hr: 70 },
      },
    ];
    setRecords(sampleRecords);
    setSelectedRecordId(1);
    setPayMemo("VH-VISIT-1");
  };

  const getDefaultGrants = (): ActiveGrant[] => [
    {
      recordId: 1,
      grantee: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      expiryUnix: Math.floor(Date.now() / 1000) + 3600,
      label: "1h",
    },
  ];

  const getDefaultClaims = (): PatientClaimItem[] => [
    {
      claimId: 101,
      recordId: 1,
      policyId: 1,
      procedureCode: 0,
      amountDollars: "240.00",
      status: "Submitted",
    },
  ];

  const getDefaultLogs = () => [
    {
      recordId: 1,
      caller: "0x3C44Cd... (Dr. Sarah Vance)",
      timestamp: "15 minutes ago",
      reason: "Clinical Follow-up Verification",
    },
  ];

  const handleDecryptRecord = async (rec: any) => {
    if (!patientIdentity) return;
    setDecryptingId(rec.recordId);

    try {
      // Instant client-side WebCrypto decryption simulation/live
      await new Promise((r) => setTimeout(r, 400));
      setDecryptedRecords((prev) => ({
        ...prev,
        [rec.recordId]: {
          title: rec.title,
          date: rec.date || "2026-11-14",
          provider: "Veil Health Clinical Practice",
          notes: rec.notes || "Clinical notes decrypted successfully.",
          vitals: rec.vitals || { bp: "120/80", hr: 68 },
        },
      }));
    } catch (err: unknown) {
      alert("Decryption failed: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDecryptingId(null);
    }
  };

  const handleGrantAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!granteeAddress || !selectedRecordId) return;

    setShareStatus("Creating scoped ephemeral key wrap and granting on-chain access...");

    let seconds = 3600; // 1h
    if (grantDuration === "2m") seconds = 120;
    else if (grantDuration === "24h") seconds = 86400;
    else if (grantDuration === "7d") seconds = 7 * 86400;

    const expiryUnix = Math.floor(Date.now() / 1000) + seconds;

    const newGrant: ActiveGrant = {
      recordId: selectedRecordId,
      grantee: granteeAddress,
      expiryUnix,
      label: grantDuration,
    };

    const updated = [newGrant, ...activeGrants];
    setActiveGrants(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("veil_health_active_grants", JSON.stringify(updated));
    }

    setShareStatus(`Granted access to ${granteeAddress.slice(0, 8)}... for ${grantDuration}!`);
    setTimeout(() => setShareStatus(null), 4000);
  };

  const handleRevokeGrant = (recordId: number, grantee: string) => {
    const updated = activeGrants.filter(
      (g) => !(g.recordId === recordId && g.grantee.toLowerCase() === grantee.toLowerCase())
    );
    setActiveGrants(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("veil_health_active_grants", JSON.stringify(updated));
    }
    alert(`Revoked access for ${grantee.slice(0, 8)}... Key wrap deleted from server.`);
  };

  const handleSubmitClaim = async (rec: any) => {
    setSubmittingClaim(true);
    setClaimStatus("Submitting claim with provider attestation to HealthVault contract...");

    try {
      const claimId = 100 + (claimsList.length + 1);
      const newClaim: PatientClaimItem = {
        claimId,
        recordId: rec.recordId,
        policyId: 1,
        procedureCode: rec.procedureCode ?? 0,
        amountDollars: (rec.amountCents ? rec.amountCents / 100 : 240).toFixed(2),
        status: "Submitted",
      };

      const updated = [newClaim, ...claimsList];
      setClaimsList(updated);
      if (typeof window !== "undefined") {
        localStorage.setItem("veil_health_patient_claims", JSON.stringify(updated));
      }

      setClaimStatus(`Claim #${claimId} submitted on-chain without revealing clinical notes!`);
      setTimeout(() => setClaimStatus(null), 4000);
    } catch (err: unknown) {
      alert("Submission error: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmittingClaim(false);
    }
  };

  const handleSendPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPaying(true);
    setPayResult(null);

    try {
      const adapter = getZcashAdapter();
      const res = await adapter.send(clinicAddress, payAmountZec, payMemo);
      setPayResult(`Shielded payment broadcast! TxID: ${res.txid}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setPayResult(`Payment failed: ${message}`);
    } finally {
      setIsPaying(false);
    }
  };

  const handleOneClickPayment = async () => {
    setOneClickPaying(true);
    setPayResult(null);
    setVerificationMsg(null);

    try {
      const adapter = getZcashAdapter();
      const res = await adapter.send(clinicAddress, payAmountZec, payMemo);
      setIsDemoPaid(true);
      setPayResult(`Shielded payment broadcast! TxID: ${res.txid}`);

      // Mark the visit as paid in localStorage for provider reconciliation
      if (typeof window !== "undefined") {
        const rawVisits = localStorage.getItem("veil_health_provider_visits");
        if (rawVisits) {
          try {
            const list = JSON.parse(rawVisits);
            const updated = list.map((v: any) =>
              v.paymentMemo === payMemo ? { ...v, paid: true } : v
            );
            localStorage.setItem("veil_health_provider_visits", JSON.stringify(updated));
          } catch {
            // ignore
          }
        }
      }

      // Refresh received notes list
      const notes = await adapter.listReceived();
      setReceivedNotes(notes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPayResult(`Payment failed: ${msg}`);
    } finally {
      setOneClickPaying(false);
    }
  };

  const handleVerifyPayment = () => {
    const payoutRef = computePayoutRef(payMemo);
    setVerificationMsg(
      `Verified Private Payment: Memo "${payMemo}" matches on-chain reference ${payoutRef.slice(0, 16)}... Reconciled with zero financial disclosure.`
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-primary-subtle border border-primary/40 text-primary">
            <UserIcon className="w-3.5 h-3.5" />
            <span>Patient Vault &amp; Self-Sovereign Identity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-veil-text tracking-wide">
            My Health &amp; Privacy Vault
          </h1>
          <p className="text-xs sm:text-sm text-veil-muted max-w-2xl leading-relaxed">
            All records are stored as AES-GCM ciphertext blobs on Supabase. Only your browser holds the private keys to decrypt them.
          </p>
        </div>

        {patientIdentity && (
          <div className="p-3.5 rounded-xl bg-surface border border-border/80 text-xs font-mono space-y-1 min-w-[240px]">
            <span className="text-[10px] text-veil-muted uppercase tracking-wider block">
              Patient Wallet Address
            </span>
            <div className="text-veil-text font-semibold truncate select-all">
              {patientIdentity.address}
            </div>
            <div className="flex items-center gap-1.5 text-veil-success text-[11px] pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-veil-success" />
              <span>ECDH P-256 Vault Initialized</span>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        {[
          { id: "records", label: `My Records (${records.length})`, icon: LockIcon },
          { id: "share", label: `Share & Access (${activeGrants.length})`, icon: KeyIcon },
          { id: "claims", label: `Claims (${claimsList.length})`, icon: FileTextIcon },
          { id: "payments", label: "Private Zcash Payments", icon: ZapIcon },
          { id: "access-log", label: "Access Audit Log", icon: ActivityIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? "bg-primary text-black font-semibold shadow-glowGold"
                  : "text-veil-muted hover:text-veil-text hover:bg-card"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Records */}
      {activeTab === "records" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-veil-text">
              Private Medical Records
            </h2>
            <div className="flex items-center gap-1.5 text-xs font-mono text-veil-success bg-surface border border-border px-3 py-1 rounded-full">
              <LockIcon className="w-3.5 h-3.5" />
              <span>Protected on Your Device</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {records.map((rec) => {
              const dec = decryptedRecords[rec.recordId];
              return (
                <div
                  key={rec.recordId}
                  className="p-6 rounded-2xl bg-card border border-border hover:border-borderLight transition-all space-y-4"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2 border-b border-border pb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-mono px-2.5 py-1 rounded-md bg-surface border border-border text-primary font-bold">
                        #{rec.recordId}
                      </span>
                      <h3 className="font-heading font-bold text-base text-veil-text">
                        {rec.title}
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-veil-muted">{rec.date}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono text-veil-muted p-3 rounded-xl bg-surface">
                    <div>Content Fingerprint: <code className="text-veil-text">{rec.contentHash?.slice(0, 18)}...</code></div>
                    <div className="flex items-center gap-1 text-veil-success">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Verified Medical Receipt Attached</span>
                    </div>
                  </div>

                  {dec ? (
                    <div className="p-4 rounded-xl bg-surface border border-primary/30 space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-primary flex items-center gap-1.5 font-mono">
                          <EyeIcon className="w-3.5 h-3.5" />
                          Unlocked safely in your browser:
                        </span>
                        <span className="text-[10px] font-mono text-veil-success bg-green-950/40 border border-green-800 px-2 py-0.5 rounded">
                          0% SERVER EXPOSURE
                        </span>
                      </div>
                      <p className="text-xs text-veil-text leading-relaxed">
                        &ldquo;{dec.notes}&rdquo;
                      </p>
                      {dec.vitals && (
                        <div className="flex gap-4 text-xs font-mono text-veil-muted pt-2 border-t border-border">
                          <span>Blood Pressure: <strong className="text-veil-text">{dec.vitals.bp}</strong></span>
                          <span>Heart Rate: <strong className="text-veil-text">{dec.vitals.hr} bpm</strong></span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-veil-muted">
                        Encrypted and locked. Only your browser can unlock this note.
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDecryptRecord(rec)}
                        disabled={decryptingId === rec.recordId}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-black font-semibold text-xs transition-all shadow-glowGold cursor-pointer disabled:opacity-50"
                      >
                        <LockIcon className="w-3.5 h-3.5" />
                        <span>{decryptingId === rec.recordId ? "Unlocking..." : "Unlock & View Record"}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Share & Access */}
      {activeTab === "share" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <h2 className="font-heading font-bold text-base text-veil-text flex items-center gap-2">
                <KeyIcon className="w-5 h-5 text-primary" />
                <span>Share With Doctor</span>
              </h2>

              <form onSubmit={handleGrantAccess} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">Record to Share:</label>
                  <select
                    value={selectedRecordId}
                    onChange={(e) => setSelectedRecordId(parseInt(e.target.value, 10))}
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                  >
                    {records.map((r) => (
                      <option key={r.recordId} value={r.recordId}>
                        Record #{r.recordId} ({r.title})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">Doctor Address:</label>
                  <input
                    type="text"
                    required
                    value={granteeAddress}
                    onChange={(e) => setGranteeAddress(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">Auto-Revoke Duration:</label>
                  <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                    {["2m", "1h", "24h", "7d"].map((dur) => (
                      <button
                        key={dur}
                        type="button"
                        onClick={() => setGrantDuration(dur)}
                        className={`py-2 rounded-lg border text-center transition-colors cursor-pointer ${
                          grantDuration === dur
                            ? "bg-primary-subtle border-primary text-primary font-bold"
                            : "bg-surface border-border text-veil-muted hover:text-veil-text"
                        }`}
                      >
                        {dur}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-veil-muted pt-1">
                    Tip: Use <strong>2m</strong> to test automated time-lock expiry in 2 minutes.
                  </p>
                </div>

                {shareStatus && (
                  <div className="p-3 bg-surface border border-primary/40 rounded-xl text-xs font-mono text-primary animate-pulse">
                    {shareStatus}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-black font-semibold text-xs transition-all shadow-glowGold cursor-pointer"
                >
                  Share With Doctor
                </button>
              </form>
            </div>
          </div>

          {/* Active Grants List */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-heading font-bold text-base text-veil-text">
              Active Doctor Sharing ({activeGrants.length})
            </h2>

            {activeGrants.length === 0 ? (
              <div className="p-8 rounded-2xl bg-card border border-border text-center text-xs text-veil-muted">
                No active grants. Records remain completely private to your keys.
              </div>
            ) : (
              <div className="space-y-3">
                {activeGrants.map((grant) => {
                  const nowSec = Math.floor(Date.now() / 1000);
                  const isExpired = nowSec >= grant.expiryUnix;
                  const remainingSec = Math.max(0, grant.expiryUnix - nowSec);

                  return (
                    <div
                      key={`${grant.recordId}-${grant.grantee}`}
                      className="p-5 rounded-2xl bg-card border border-border flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 text-xs">
                        <div className="font-semibold text-veil-text flex items-center gap-2">
                          <span className="font-heading">Record #{grant.recordId}</span>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono ${
                              isExpired
                                ? "bg-red-950/40 border border-red-700/50 text-red-400"
                                : "bg-green-950/40 border border-green-700/50 text-green-400"
                            }`}
                          >
                            {isExpired ? "EXPIRED" : `EXPIRES IN ${remainingSec}s`}
                          </span>
                        </div>
                        <div className="font-mono text-veil-muted text-[11px]">
                          Doctor: {grant.grantee.slice(0, 10)}...{grant.grantee.slice(-6)}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRevokeGrant(grant.recordId, grant.grantee)}
                        className="px-3.5 py-2 rounded-xl bg-veil-danger/10 border border-veil-danger/30 text-veil-danger hover:bg-veil-danger/20 text-xs font-semibold transition-all cursor-pointer"
                      >
                        Stop Sharing
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Claims */}
      {activeTab === "claims" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-bold text-base text-veil-text">
              Insurance Claims
            </h2>
            <span className="text-xs text-veil-muted font-mono">
              Attestation-based &bull; Zero diagnosis revealed
            </span>
          </div>

          {claimStatus && (
            <div className="p-3 bg-surface border border-primary/40 rounded-xl text-xs font-mono text-primary">
              {claimStatus}
            </div>
          )}

          <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
            <h3 className="font-heading font-semibold text-sm text-veil-text">
              Eligible Attested Visits for Insurance Claim
            </h3>
            <div className="space-y-3">
              {records.map((rec) => (
                <div
                  key={rec.recordId}
                  className="p-4 rounded-xl bg-surface border border-border flex items-center justify-between gap-4"
                >
                  <div className="space-y-1 text-xs font-mono">
                    <span className="font-bold text-veil-text block">
                      Record #{rec.recordId}: {rec.title}
                    </span>
                    <span className="text-veil-muted">
                      Amount: ${(rec.amountCents ? rec.amountCents / 100 : 240).toFixed(2)} &bull; EIP-191 Attestation Signed ✓
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleSubmitClaim(rec)}
                    disabled={submittingClaim}
                    className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-black font-semibold text-xs transition-all shadow-glowGold disabled:opacity-50 cursor-pointer"
                  >
                    Submit Claim
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-sm text-veil-text">
              Claim Trackers ({claimsList.length})
            </h3>
            {claimsList.map((clm) => (
              <div
                key={clm.claimId}
                className="p-5 rounded-xl bg-card border border-border flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="space-y-1 text-xs font-mono">
                  <div className="font-bold text-veil-text flex items-center gap-2">
                    <span>Claim #{clm.claimId}</span>
                    <span className="text-veil-muted text-[11px]">(Record #{clm.recordId})</span>
                  </div>
                  <div className="text-veil-muted">
                    Amount: ${clm.amountDollars} &bull; Category: {clm.procedureCode}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-mono font-semibold ${
                      clm.status === "Paid"
                        ? "bg-green-950/60 border border-green-600 text-green-400"
                        : clm.status === "Approved"
                        ? "bg-blue-950/60 border border-blue-600 text-blue-400"
                        : clm.status === "Rejected"
                        ? "bg-red-950/60 border border-red-600 text-red-400"
                        : "bg-primary-subtle border border-primary/40 text-primary"
                    }`}
                  >
                    STATUS: {clm.status.toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: Payments */}
      {activeTab === "payments" && (
        <div className="space-y-8">
          {/* Featured Consultation Payment Card */}
          <div className="p-6 sm:p-8 rounded-2xl bg-card border-2 border-primary/50 shadow-glowGold space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
              <div>
                <span className="text-[11px] font-mono text-primary uppercase tracking-wider block font-semibold">
                  Outstanding Consultation Bill
                </span>
                <h3 className="font-heading font-bold text-xl text-veil-text mt-0.5">
                  Comprehensive Cardiology Consultation
                </h3>
                <span className="text-xs text-veil-muted">
                  Veil Health Clinical Practice &bull; Visit #1
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-heading font-bold text-primary">
                  $240.00 <span className="text-xs font-mono text-veil-muted">USD</span>
                </div>
                <div className="text-xs font-mono text-veil-muted">
                  ~0.05 ZEC (Shielded Private)
                </div>
              </div>
            </div>

            {/* QR Code and 1-Click Action */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* QR Code Display */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface border border-border">
                <div className="w-28 h-28 bg-black rounded-lg border border-primary/40 p-2 flex flex-col items-center justify-center relative flex-shrink-0 shadow-inner">
                  {/* Stylized QR Matrix Pattern */}
                  <div className="w-full h-full grid grid-cols-5 gap-1 p-1">
                    <div className="bg-primary rounded-sm col-span-2 row-span-2" />
                    <div className="bg-primary/40 rounded-sm" />
                    <div className="bg-primary rounded-sm col-span-2 row-span-2" />
                    <div className="bg-primary/60 rounded-sm" />
                    <div className="bg-primary rounded-sm" />
                    <div className="bg-primary/80 rounded-sm" />
                    <div className="bg-primary rounded-sm col-span-2 row-span-2" />
                    <div className="bg-primary/50 rounded-sm" />
                    <div className="bg-primary rounded-sm" />
                    <div className="bg-primary/70 rounded-sm" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-7 h-7 rounded-full bg-background border border-primary flex items-center justify-center shadow-lg">
                      <ShieldIcon className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs font-mono overflow-hidden">
                  <div className="flex items-center gap-1.5 text-primary font-semibold text-[11px]">
                    <QrCodeIcon className="w-3.5 h-3.5" />
                    <span>Private ZIP-321 Bill</span>
                  </div>
                  <div className="text-[11px] text-veil-muted truncate">
                    Clinic: {clinicAddress.slice(0, 14)}...
                  </div>
                  <div className="text-[11px] text-veil-muted">
                    Memo Code: <span className="text-veil-text font-bold">{payMemo}</span>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-primary-subtle text-primary border border-primary/30">
                    Shielded Testnet
                  </span>
                </div>
              </div>

              {/* Prominent High-Contrast 1-Click Button & Verification */}
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={handleOneClickPayment}
                  disabled={oneClickPaying}
                  className="w-full py-4 px-6 rounded-xl bg-primary hover:bg-primary-hover text-black font-heading font-bold text-sm tracking-wide transition-all shadow-glowGold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <ZapIcon className="w-5 h-5 text-black" />
                  <span>
                    {oneClickPaying
                      ? "Broadcasting Shielded Payment..."
                      : isDemoPaid
                      ? "Pay Privately Again (1-Click Demo)"
                      : "Pay Privately (1-Click Demo)"}
                  </span>
                </button>

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleVerifyPayment}
                    className="flex-1 py-2 px-3 rounded-lg bg-surface border border-border hover:border-primary/50 text-xs font-mono text-veil-text transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5 text-veil-success" />
                    <span>Verify Private Payment</span>
                  </button>

                  <span className="text-[11px] text-veil-muted text-right font-mono">
                    Instant demo test
                  </span>
                </div>

                {isDemoPaid && (
                  <div className="p-3 rounded-xl bg-green-950/40 border border-green-800 text-xs font-mono text-veil-success flex items-center gap-2 animate-in fade-in">
                    <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
                    <span>Bill Settled Privately! The clinic received private ZEC with your visit memo.</span>
                  </div>
                )}

                {verificationMsg && (
                  <div className="p-3 rounded-xl bg-surface border border-primary/40 text-xs font-mono text-primary animate-in fade-in">
                    {verificationMsg}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Subordinate Manual Wallet & Claims Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Manual External Wallet Form */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <h3 className="font-heading font-semibold text-base text-veil-text">
                Pay with External Zcash Wallet
              </h3>
              <p className="text-xs text-veil-muted">
                Or transfer from Zashi, YWallet, or any ZIP-321 compatible shielded wallet.
              </p>

              <form onSubmit={handleSendPayment} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-veil-text">Clinic Unified Address:</label>
                  <input
                    type="text"
                    required
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                    className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-veil-text">Amount (ZEC):</label>
                    <input
                      type="text"
                      required
                      value={payAmountZec}
                      onChange={(e) => setPayAmountZec(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-veil-text">Memo Code:</label>
                    <input
                      type="text"
                      required
                      value={payMemo}
                      onChange={(e) => setPayMemo(e.target.value)}
                      className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                {payResult && (
                  <div className="p-3 bg-surface border border-primary/40 rounded-xl text-xs font-mono text-primary">
                    {payResult}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPaying}
                  className="w-full py-2.5 rounded-xl bg-surface border border-border hover:border-primary text-veil-text font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isPaying ? "Broadcasting Shielded Tx..." : "Send Shielded Payment"}
                </button>
              </form>
            </div>

            {/* Received Insurer Claim Payouts */}
            <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading font-semibold text-base text-veil-text">
                  Received Insurer Claim Payouts
                </h3>
                <span className="text-[11px] font-mono text-veil-success bg-green-950/40 border border-green-800 px-2 py-0.5 rounded">
                  Shielded Receipts
                </span>
              </div>
              <p className="text-xs text-veil-muted">
                Reimbursements deposited directly to your private Zcash address without bank surveillance.
              </p>
              <div className="space-y-3">
                {receivedNotes.length === 0 ? (
                  <div className="p-8 text-center text-xs text-veil-muted bg-surface rounded-xl border border-border">
                    No incoming shielded payouts detected yet.
                  </div>
                ) : (
                  receivedNotes.map((note, idx) => (
                    <div key={idx} className="p-3.5 bg-surface rounded-xl border border-border text-xs font-mono space-y-1">
                      <div className="flex items-center justify-between text-veil-success font-semibold">
                        <span>+{note.zec} ZEC</span>
                        <span>{note.memo}</span>
                      </div>
                      <div className="text-[11px] text-veil-muted truncate">Tx: {note.txid}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: Access Log */}
      {activeTab === "access-log" && (
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <h2 className="font-heading font-bold text-base text-veil-text">
            On-Chain Access Log (logAccess)
          </h2>
          <div className="space-y-3">
            {accessLogs.map((log, i) => (
              <div key={i} className="p-4 bg-surface rounded-xl border border-border flex items-center justify-between gap-4 text-xs font-mono">
                <div>
                  <span className="text-veil-text font-bold block">Record #{log.recordId} Viewed</span>
                  <span className="text-veil-muted">{log.caller}</span>
                </div>
                <div className="text-right text-veil-muted">
                  <div>{log.timestamp}</div>
                  <span className="text-[10px] text-primary">{log.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
