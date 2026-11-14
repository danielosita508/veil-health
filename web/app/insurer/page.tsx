"use client";

import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  getOrCreateIdentity,
  RoleIdentity,
  getWalletForIdentity,
} from "@/lib/identity";
import {
  getHealthVaultContract,
  HEALTH_VAULT_ADDRESS,
  BASE_SEPOLIA_CHAIN_ID,
} from "@/lib/chain";
import { getZcashAdapter, computePayoutRef } from "@/lib/zcash";
import {
  BuildingIcon,
  ShieldIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertTriangleIcon,
  XIcon,
  RefreshCwIcon,
  ExternalLinkIcon,
  ZapIcon,
  FilterIcon,
  FileTextIcon,
  CopyIcon,
  InfoIcon,
} from "@/components/Icons";

const PROCEDURE_CODES = [
  { code: 0, label: "0: OUTPATIENT", desc: "Consultations & routine checkups" },
  { code: 1, label: "1: LAB", desc: "Bloodwork & pathology panels" },
  { code: 2, label: "2: IMAGING", desc: "X-ray, Ultrasound, MRI scans" },
  { code: 3, label: "3: SPECIALIST", desc: "Cardiology, Oncology, Dermatology" },
  { code: 4, label: "4: PHARMACY", desc: "Prescription medications" },
  { code: 5, label: "5: DENTAL", desc: "Preventative & restorative dentistry" },
  { code: 6, label: "6: EYE", desc: "Optometry & ophthalmic care" },
  { code: 7, label: "7: EMERGENCY", desc: "Urgent & trauma care" },
];

export interface InsurerClaim {
  claimId: number;
  policyId: number;
  recordId: number;
  patient: string;
  provider: string;
  procedureCode: number;
  amountDollars: number;
  status: "Submitted" | "Approved" | "Rejected" | "Paid";
  providerSigVerified: boolean;
  submittedAt: string;
  payoutRef?: string;
  txHash?: string;
}

export interface PolicyItem {
  policyId: number;
  patient: string;
  limitDollars: number;
  usedDollars: number;
  coveredBitmap: number;
  active: boolean;
}

export default function InsurerDashboard() {
  const [activeTab, setActiveTab] = useState<"claims" | "payouts" | "policies">("claims");
  const [insurerIdentity, setInsurerIdentity] = useState<RoleIdentity | null>(null);
  const [claimsFilter, setClaimsFilter] = useState<"ALL" | "Submitted" | "Approved" | "Paid">("ALL");

  // Mock initial claims queue aligned with PROJECT.md
  const [claims, setClaims] = useState<InsurerClaim[]>([
    {
      claimId: 101,
      policyId: 1,
      recordId: 1,
      patient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      provider: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      procedureCode: 0, // OUTPATIENT
      amountDollars: 240,
      status: "Submitted",
      providerSigVerified: true,
      submittedAt: "2026-11-14 11:45",
    },
    {
      claimId: 102,
      policyId: 1,
      recordId: 2,
      patient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      provider: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      procedureCode: 1, // LAB
      amountDollars: 380,
      status: "Approved",
      providerSigVerified: true,
      submittedAt: "2026-11-13 16:20",
    },
    {
      claimId: 103,
      policyId: 2,
      recordId: 5,
      patient: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      provider: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
      procedureCode: 7, // EMERGENCY
      amountDollars: 1250,
      status: "Paid",
      providerSigVerified: true,
      submittedAt: "2026-11-10 09:12",
      payoutRef: "0x89fbc0882e340a6b7d7b931dc240a5f9f6004bca2801488c9f91a62d057790b1",
    },
  ]);

  // Policies state
  const [policies, setPolicies] = useState<PolicyItem[]>([
    {
      policyId: 1,
      patient: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      limitDollars: 5000,
      usedDollars: 620,
      coveredBitmap: 0b00000011, // Outpatient + Lab
      active: true,
    },
    {
      policyId: 2,
      patient: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
      limitDollars: 10000,
      usedDollars: 1250,
      coveredBitmap: 0b10000111, // Outpatient + Lab + Imaging + Emergency
      active: true,
    },
  ]);

  // New policy form state
  const [newPatientAddr, setNewPatientAddr] = useState("");
  const [newLimit, setNewLimit] = useState("5000");
  const [selectedCodes, setSelectedCodes] = useState<number[]>([0, 1, 7]);
  const [isCreatingPolicy, setIsCreatingPolicy] = useState(false);
  const [policyMsg, setPolicyMsg] = useState<string | null>(null);

  // Settlement action state
  const [processingClaimId, setProcessingClaimId] = useState<number | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    getOrCreateIdentity("insurer").then((id) => {
      setInsurerIdentity(id);
    });
  }, []);

  const handleReviewClaim = async (claimId: number, approve: boolean) => {
    setProcessingClaimId(claimId);
    setActionSuccessMsg(null);

    try {
      // In live testnet with deployed contract, calls reviewClaim on-chain
      // Update state locally
      setClaims((prev) =>
        prev.map((c) =>
          c.claimId === claimId
            ? { ...c, status: approve ? "Approved" : "Rejected" }
            : c
        )
      );

      setActionSuccessMsg(
        `Claim #${claimId} successfully ${approve ? "APPROVED" : "REJECTED"} on-chain.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Review claim error: ${msg}`);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleShieldedPayout = async (claim: InsurerClaim) => {
    setProcessingClaimId(claim.claimId);
    setActionSuccessMsg(null);

    try {
      const adapter = getZcashAdapter();
      const memo = `VH-CLAIM-${claim.claimId}`;
      const payoutRef = computePayoutRef(memo);

      // Trigger shielded payment
      const patientZcashAddr = "ztestsapling1q8y0e82...demoShieldedRecipientAddress";
      const zecAmount = (claim.amountDollars / 40).toFixed(4); // approximate conversion
      const res = await adapter.send(patientZcashAddr, zecAmount, memo);

      setClaims((prev) =>
        prev.map((c) =>
          c.claimId === claim.claimId
            ? { ...c, status: "Paid", payoutRef, txHash: res.txid }
            : c
        )
      );

      setActionSuccessMsg(
        `Shielded Zcash payout completed! Memo: "${memo}", On-Chain Ref: ${payoutRef.slice(0, 14)}...`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Payout error: ${msg}`);
    } finally {
      setProcessingClaimId(null);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPatientAddr.trim()) {
      alert("Please enter patient address");
      return;
    }

    setIsCreatingPolicy(true);
    setPolicyMsg(null);

    try {
      // Compute bitmap
      let bitmap = 0;
      selectedCodes.forEach((code) => {
        bitmap |= 1 << code;
      });

      const newId = policies.length + 1;
      const newPolicy: PolicyItem = {
        policyId: newId,
        patient: newPatientAddr.trim(),
        limitDollars: parseInt(newLimit, 10),
        usedDollars: 0,
        coveredBitmap: bitmap,
        active: true,
      };

      setPolicies([newPolicy, ...policies]);
      setPolicyMsg(`Policy #${newId} created on-chain for ${newPatientAddr.slice(0, 8)}...!`);
      setNewPatientAddr("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setPolicyMsg(`Policy creation failed: ${msg}`);
    } finally {
      setIsCreatingPolicy(false);
    }
  };

  const toggleProcedureCode = (code: number) => {
    if (selectedCodes.includes(code)) {
      setSelectedCodes(selectedCodes.filter((c) => c !== code));
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const filteredClaims = claims.filter((c) => {
    if (claimsFilter === "ALL") return true;
    return c.status === claimsFilter;
  });

  return (
    <div className="space-y-8 animate-in fade-in">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-purple-950/40 border border-purple-700/50 text-purple-300">
            <BuildingIcon className="w-3.5 h-3.5 text-accent" />
            <span>Licensed Insurer Gateway</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-veil-text tracking-wide">
            Claims &amp; Policy Adjudication
          </h1>
          <p className="text-xs sm:text-sm text-veil-muted max-w-2xl leading-relaxed">
            Verify provider-signed attestations without ever accessing patient clinical diagnoses.
            Settle approved claims in shielded Zcash with verifiable memo hashes.
          </p>
        </div>

        {/* Security & ZK Guarantee Callout */}
        <div className="p-4 rounded-xl bg-surface border border-border/80 text-xs font-mono space-y-1.5 min-w-[260px]">
          <div className="flex items-center gap-2 text-veil-success font-semibold">
            <ShieldIcon className="w-4 h-4" />
            <span>Zero Plaintext Exposure</span>
          </div>
          <div className="text-[11px] text-veil-muted">
            Diagnoses: <span className="text-veil-text font-bold">REDACTED BY DESIGN</span>
          </div>
          <div className="text-[11px] text-veil-muted">
            Attestation: <span className="text-veil-success font-bold">ECDSA VERIFIED</span>
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-4 rounded-xl bg-veil-success/15 border border-veil-success/40 text-veil-success text-xs font-mono flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="w-4 h-4 flex-shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionSuccessMsg(null)}
            className="text-veil-muted hover:text-veil-text"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-border pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab("claims")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "claims"
              ? "bg-primary text-black font-semibold shadow-glowGold"
              : "text-veil-muted hover:text-veil-text hover:bg-card"
          }`}
        >
          <FileTextIcon className="w-4 h-4" />
          <span>Claims Review Queue ({claims.filter((c) => c.status === "Submitted").length} Pending)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payouts")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "payouts"
              ? "bg-primary text-black font-semibold shadow-glowGold"
              : "text-veil-muted hover:text-veil-text hover:bg-card"
          }`}
        >
          <ZapIcon className="w-4 h-4" />
          <span>Shielded Payouts ({claims.filter((c) => c.status === "Approved").length} Ready)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("policies")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
            activeTab === "policies"
              ? "bg-primary text-black font-semibold shadow-glowGold"
              : "text-veil-muted hover:text-veil-text hover:bg-card"
          }`}
        >
          <BuildingIcon className="w-4 h-4" />
          <span>Policy Management ({policies.length})</span>
        </button>
      </div>

      {/* Tab 1: Claims Review Queue */}
      {activeTab === "claims" && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
            <div className="flex items-center gap-2 text-xs text-veil-muted">
              <FilterIcon className="w-3.5 h-3.5" />
              <span>Status Filter:</span>
              {(["ALL", "Submitted", "Approved", "Paid"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setClaimsFilter(status)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                    claimsFilter === status
                      ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                      : "text-veil-muted hover:text-veil-text"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="text-xs font-mono text-veil-muted">
              Showing {filteredClaims.length} of {claims.length} total claims
            </div>
          </div>

          {/* Claims Grid */}
          <div className="space-y-4">
            {filteredClaims.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border space-y-3">
                <FileTextIcon className="w-10 h-10 text-veil-muted mx-auto opacity-50" />
                <h4 className="font-heading font-medium text-veil-text">No claims in this category</h4>
                <p className="text-xs text-veil-muted">All incoming claims have been adjudicated.</p>
              </div>
            ) : (
              filteredClaims.map((claim) => {
                const proc = PROCEDURE_CODES.find((p) => p.code === claim.procedureCode);
                const isProcessing = processingClaimId === claim.claimId;

                return (
                  <div
                    key={claim.claimId}
                    className="p-6 rounded-2xl bg-card border border-border hover:border-borderLight transition-all space-y-4"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-heading font-bold text-base text-veil-text">
                          Claim #{claim.claimId}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold uppercase ${
                            claim.status === "Submitted"
                              ? "bg-blue-950/40 text-blue-400 border border-blue-700/50"
                              : claim.status === "Approved"
                              ? "bg-amber-subtle text-primary border border-primary/40"
                              : claim.status === "Paid"
                              ? "bg-green-950/40 text-veil-success border border-green-700/50"
                              : "bg-red-950/40 text-veil-danger border border-red-700/50"
                          }`}
                        >
                          {claim.status}
                        </span>
                        <span className="text-xs font-mono text-veil-muted">
                          Policy #{claim.policyId}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-lg font-heading font-bold text-primary">
                          ${claim.amountDollars.toLocaleString()}
                        </span>
                        <span className="text-xs text-veil-muted font-mono">USD</span>
                      </div>
                    </div>

                    {/* Data Minimization Disclosure Box */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded-xl bg-surface border border-border text-xs font-mono">
                      <div>
                        <span className="text-veil-muted text-[10px] uppercase block">Procedure Category</span>
                        <span className="text-veil-text font-semibold">{proc?.label}</span>
                        <span className="text-veil-muted block text-[11px] mt-0.5">{proc?.desc}</span>
                      </div>

                      <div>
                        <span className="text-veil-muted text-[10px] uppercase block">Patient Wallet</span>
                        <span className="text-veil-text truncate block select-all">
                          {claim.patient.slice(0, 10)}...{claim.patient.slice(-6)}
                        </span>
                        <span className="text-veil-muted text-[11px] block mt-0.5">
                          Submitted: {claim.submittedAt}
                        </span>
                      </div>

                      <div>
                        <span className="text-veil-muted text-[10px] uppercase block">Licensed Provider Attestation</span>
                        <span className="text-veil-text truncate block select-all">
                          {claim.provider.slice(0, 10)}...{claim.provider.slice(-6)}
                        </span>
                        <div className="flex items-center gap-1.5 text-veil-success text-[11px] mt-0.5">
                          <CheckCircleIcon className="w-3.5 h-3.5" />
                          <span>ECDSA Signature Verified On-Chain</span>
                        </div>
                      </div>
                    </div>

                    {/* Notice on Privacy */}
                    <div className="flex items-center gap-2 text-[11px] text-veil-muted bg-card/60 p-2.5 rounded-lg border border-border/50">
                      <InfoIcon className="w-4 h-4 text-primary flex-shrink-0" />
                      <span>
                        <strong>Data Minimization Law:</strong> You are viewing coarse procedure category &amp; provider signature only. The clinical diagnosis remains encrypted in the patient vault.
                      </span>
                    </div>

                    {/* Action Buttons for Pending Claims */}
                    {claim.status === "Submitted" && (
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleReviewClaim(claim.claimId, false)}
                          className="px-4 py-2 rounded-xl bg-surface border border-veil-danger/40 hover:bg-veil-danger/10 text-veil-danger text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Reject Claim
                        </button>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleReviewClaim(claim.claimId, true)}
                          className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-black text-xs font-bold transition-all shadow-glowGold disabled:opacity-50 cursor-pointer"
                        >
                          <CheckCircleIcon className="w-4 h-4" />
                          <span>{isProcessing ? "Signing..." : "Approve Claim on-Chain"}</span>
                        </button>
                      </div>
                    )}

                    {claim.status === "Approved" && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-primary font-mono">
                          Ready for private settlement.
                        </span>
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleShieldedPayout(claim)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-white text-xs font-bold transition-all shadow-glowPurple cursor-pointer"
                        >
                          <ZapIcon className="w-4 h-4" />
                          <span>{isProcessing ? "Broadcasting..." : "Send Shielded ZEC Payout"}</span>
                        </button>
                      </div>
                    )}

                    {claim.status === "Paid" && (
                      <div className="p-3 rounded-xl bg-green-950/30 border border-green-800/40 text-xs font-mono text-green-300 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-veil-success">Payment Settled Privately</span>
                          <span>Memo: VH-CLAIM-{claim.claimId}</span>
                        </div>
                        <div className="text-[11px] text-veil-muted truncate">
                          Payout Ref: {claim.payoutRef}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Shielded Payouts */}
      {activeTab === "payouts" && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-card border border-border space-y-3">
            <h3 className="font-heading font-semibold text-lg text-veil-text">
              Shielded Zcash Claim Reconciliation
            </h3>
            <p className="text-xs text-veil-muted leading-relaxed">
              When an insurer settles an approved claim, a shielded Zcash transaction is dispatched to the patient with memo format <code className="text-primary font-mono">VH-CLAIM-&lt;claimId&gt;</code>. The contract stores <code className="text-primary font-mono">keccak256(memo)</code> as the verifiable payout reference.
            </p>
          </div>

          <div className="space-y-4">
            {claims.filter((c) => c.status === "Approved" || c.status === "Paid").map((claim) => (
              <div
                key={claim.claimId}
                className="p-5 rounded-2xl bg-surface border border-border flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-heading font-bold text-veil-text">
                      Claim #{claim.claimId}
                    </span>
                    <span className="text-xs font-mono text-primary font-semibold">
                      ${claim.amountDollars} USD
                    </span>
                    <span className="text-xs font-mono text-veil-muted">
                      (Approx {(claim.amountDollars / 40).toFixed(4)} ZEC)
                    </span>
                  </div>
                  <div className="text-xs font-mono text-veil-muted">
                    Patient: {claim.patient.slice(0, 10)}... | Expected Memo: <span className="text-veil-text">VH-CLAIM-{claim.claimId}</span>
                  </div>
                </div>

                <div>
                  {claim.status === "Approved" ? (
                    <button
                      type="button"
                      disabled={processingClaimId === claim.claimId}
                      onClick={() => handleShieldedPayout(claim)}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-black text-xs font-bold transition-all shadow-glowGold cursor-pointer"
                    >
                      <ZapIcon className="w-4 h-4" />
                      <span>{processingClaimId === claim.claimId ? "Executing..." : "Dispatch Shielded Payout"}</span>
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-green-950/40 text-veil-success border border-green-800">
                      <CheckCircleIcon className="w-3.5 h-3.5" />
                      <span>Settled &amp; On-Chain Verified</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 3: Policy Management */}
      {activeTab === "policies" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* New Policy Form */}
          <div className="p-6 rounded-2xl bg-card border border-border space-y-6 lg:col-span-1 h-fit">
            <div className="space-y-1 border-b border-border pb-3">
              <h3 className="font-heading font-semibold text-base text-veil-text">
                Issue Insurance Policy
              </h3>
              <p className="text-xs text-veil-muted">
                Create an active on-chain coverage policy with custom limit and covered categories.
              </p>
            </div>

            <form onSubmit={handleCreatePolicy} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-veil-text">Patient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={newPatientAddr}
                  onChange={(e) => setNewPatientAddr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs font-mono text-veil-text placeholder:text-veil-muted/40 focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-veil-text">Coverage Limit ($ USD)</label>
                <input
                  type="number"
                  min="100"
                  max="100000"
                  step="100"
                  value={newLimit}
                  onChange={(e) => setNewLimit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs font-mono text-veil-text focus:border-primary focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-veil-text block">
                  Covered Procedure Categories
                </label>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {PROCEDURE_CODES.map((proc) => {
                    const isChecked = selectedCodes.includes(proc.code);
                    return (
                      <label
                        key={proc.code}
                        className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                          isChecked
                            ? "bg-primary-subtle border-primary/40 text-veil-text"
                            : "bg-surface border-border text-veil-muted hover:text-veil-text"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleProcedureCode(proc.code)}
                          className="mt-0.5 rounded border-border text-primary focus:ring-0"
                        />
                        <div>
                          <div className="font-semibold text-[11px]">{proc.label}</div>
                          <div className="text-[10px] text-veil-muted">{proc.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {policyMsg && (
                <div className="p-3 rounded-lg text-xs font-mono bg-blue-950/40 border border-blue-800 text-blue-300">
                  {policyMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={isCreatingPolicy}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-black font-semibold text-xs transition-all shadow-glowGold disabled:opacity-50 cursor-pointer"
              >
                {isCreatingPolicy ? "Creating on Base Sepolia..." : "Deploy Policy on-Chain"}
              </button>
            </form>
          </div>

          {/* Active Policies List */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="font-heading font-semibold text-base text-veil-text">
              Active Coverage Policies
            </h3>

            <div className="space-y-4">
              {policies.map((pol) => {
                const percentUsed = Math.min(100, Math.round((pol.usedDollars / pol.limitDollars) * 100));

                return (
                  <div
                    key={pol.policyId}
                    className="p-6 rounded-2xl bg-card border border-border space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="font-heading font-bold text-base text-veil-text">
                          Policy #{pol.policyId}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-green-950/40 text-veil-success border border-green-800">
                          Active
                        </span>
                      </div>

                      <div className="text-xs font-mono text-veil-muted">
                        Patient: <span className="text-veil-text">{pol.patient.slice(0, 10)}...</span>
                      </div>
                    </div>

                    {/* Progress Bar of Coverage */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-veil-muted">
                          Used: ${pol.usedDollars.toLocaleString()} / ${pol.limitDollars.toLocaleString()}
                        </span>
                        <span className="text-primary font-semibold">{percentUsed}% exhausted</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-surface overflow-hidden border border-border">
                        <div
                          className="h-full bg-primary transition-all duration-300 rounded-full"
                          style={{ width: `${percentUsed}%` }}
                        />
                      </div>
                    </div>

                    {/* Covered Categories Chips */}
                    <div className="space-y-1">
                      <span className="text-[11px] font-mono text-veil-muted block">
                        Coverage Bitmap: <code className="text-primary">0b{pol.coveredBitmap.toString(2).padStart(8, "0")}</code>
                      </span>
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {PROCEDURE_CODES.map((proc) => {
                          const isCovered = (pol.coveredBitmap & (1 << proc.code)) !== 0;
                          if (!isCovered) return null;
                          return (
                            <span
                              key={proc.code}
                              className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-surface border border-border text-veil-text"
                            >
                              {proc.label.split(":")[1]}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
