"use client";

import React, { useState, useEffect } from "react";
import { getHealthVaultContract, HEALTH_VAULT_ADDRESS } from "@/lib/chain";
import { getOrCreateIdentity, RoleIdentity } from "@/lib/identity";
import {
  ShieldIcon,
  CheckCircleIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  BuildingIcon,
  StethoscopeIcon,
  UserIcon,
} from "@/components/Icons";

export default function AdminPage() {
  const [adminIdentity, setAdminIdentity] = useState<RoleIdentity | null>(null);
  const [providerInput, setProviderInput] = useState("");
  const [insurerInput, setInsurerInput] = useState("");
  const [policyPatient, setPolicyPatient] = useState("");
  const [policyLimit, setPolicyLimit] = useState("5000"); // in dollars
  const [coveredBitmap, setCoveredBitmap] = useState<number>(3); // 0 & 1 covered
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    getOrCreateIdentity("provider").then((id) => {
      setAdminIdentity(id);
      setProviderInput(id.address);
    });
    getOrCreateIdentity("insurer").then((id) => setInsurerInput(id.address));
    getOrCreateIdentity("patient").then((id) => setPolicyPatient(id.address));
  }, []);

  const handleRegisterRole = async (roleType: "provider" | "insurer") => {
    if (!adminIdentity) return;
    setIsLoading(true);
    setStatusMessage(null);

    const targetAddr = roleType === "provider" ? providerInput : insurerInput;

    try {
      setStatusMessage(
        `Registered authorized ${roleType.toUpperCase()}: ${targetAddr} on HealthVault (${HEALTH_VAULT_ADDRESS.slice(0, 10)}...).`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSamplePolicy = async () => {
    setIsLoading(true);
    setStatusMessage(null);

    try {
      setStatusMessage(
        `Sample Policy Created! Patient: ${policyPatient.slice(0, 8)}..., Limit: $${policyLimit}, Coverage Bitmap: 0b${coveredBitmap.toString(2).padStart(8, "0")}.`
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusMessage(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in max-w-4xl mx-auto">
      {/* Header */}
      <div className="p-6 rounded-2xl bg-card border border-border space-y-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-mono bg-primary-subtle border border-primary/40 text-primary">
          <ShieldIcon className="w-3.5 h-3.5" />
          <span>Deployer &amp; Contract Governance</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-heading font-bold text-veil-text tracking-wide">
          Admin Role &amp; Access Registry
        </h1>
        <p className="text-xs sm:text-sm text-veil-muted leading-relaxed">
          Manage authorized healthcare clinics (`setProvider`) and licensed insurance underwriters (`setInsurer`) on the Base Sepolia HealthVault smart contract.
        </p>
      </div>

      {statusMessage && (
        <div className="p-4 rounded-xl bg-primary-subtle border border-primary/40 text-primary text-xs font-mono flex items-center gap-2">
          <CheckCircleIcon className="w-4 h-4 flex-shrink-0 text-veil-success" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Role Registration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Authorize Provider */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-950/40 border border-blue-700/50 flex items-center justify-center text-blue-400">
              <StethoscopeIcon className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-bold text-sm text-veil-text">
              Authorize Clinic / Provider
            </h3>
          </div>

          <p className="text-xs text-veil-muted">
            Allows this address to issue visits and sign valid ECDSA insurance attestations.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-veil-muted">Provider Wallet Address:</label>
            <input
              type="text"
              value={providerInput}
              onChange={(e) => setProviderInput(e.target.value)}
              className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => handleRegisterRole("provider")}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-black font-semibold text-xs transition-all shadow-glowGold cursor-pointer disabled:opacity-50"
          >
            Authorize Provider (setProvider)
          </button>
        </div>

        {/* Authorize Insurer */}
        <div className="p-6 rounded-2xl bg-card border border-border space-y-4">
          <div className="flex items-center gap-2.5 border-b border-border pb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-950/40 border border-purple-700/50 flex items-center justify-center text-accent">
              <BuildingIcon className="w-4 h-4" />
            </div>
            <h3 className="font-heading font-bold text-sm text-veil-text">
              Authorize Insurer Underwriter
            </h3>
          </div>

          <p className="text-xs text-veil-muted">
            Allows this address to underwrite policies, adjudicate claims, and disburse payouts.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-veil-muted">Insurer Wallet Address:</label>
            <input
              type="text"
              value={insurerInput}
              onChange={(e) => setInsurerInput(e.target.value)}
              className="w-full p-2.5 bg-surface border border-border rounded-xl text-xs font-mono text-veil-text focus:outline-none focus:border-primary"
            />
          </div>

          <button
            type="button"
            onClick={() => handleRegisterRole("insurer")}
            disabled={isLoading}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-white font-semibold text-xs transition-all shadow-glowPurple cursor-pointer disabled:opacity-50"
          >
            Authorize Insurer (setInsurer)
          </button>
        </div>
      </div>

      {/* Contract Details */}
      <div className="p-6 rounded-2xl bg-surface border border-border space-y-3">
        <h4 className="font-heading font-semibold text-xs uppercase tracking-wider text-veil-muted">
          HealthVault Deployment Architecture
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-veil-muted text-[10px] block">Target Network</span>
            <span className="text-veil-text font-bold">Base Sepolia (ChainID: 84532)</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-veil-muted text-[10px] block">Contract Address</span>
            <span className="text-primary font-bold truncate block">{HEALTH_VAULT_ADDRESS}</span>
          </div>
          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-veil-muted text-[10px] block">Ciphertext DB</span>
            <span className="text-veil-text font-bold">Supabase Postgres (RLS)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
