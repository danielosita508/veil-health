import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeaders } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getHealthVaultContract } from "@/lib/chain";
import { computeContentHash } from "@/lib/crypto";
import { ethers } from "ethers";

/**
 * POST /api/blob
 * Uploads encrypted medical record ciphertext.
 * Permitted only if:
 * 1. Caller signature is valid within 5-minute window
 * 2. Caller is the record's on-chain provider
 * 3. sha256(ciphertext) == contentHash == on-chain contentHash
 */
export async function POST(req: NextRequest) {
  const auth = verifyAuthHeaders(req.headers, "POST", "/api/blob");
  if (!auth.valid || !auth.address) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { recordId, ciphertext, iv, contentHash } = body;

    if (
      recordId === undefined ||
      recordId === null ||
      !ciphertext ||
      !iv ||
      !contentHash
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: recordId, ciphertext, iv, contentHash.",
        },
        { status: 400 }
      );
    }

    const numericRecordId = Number(recordId);
    if (isNaN(numericRecordId)) {
      return NextResponse.json(
        { error: "Invalid recordId format." },
        { status: 400 }
      );
    }

    // Verify on-chain record: caller must be the provider
    const contract = getHealthVaultContract();
    const onChainRecord = await contract.records(numericRecordId);
    const [, provider, onChainHash] = onChainRecord;

    if (!provider || provider === ethers.ZeroAddress) {
      return NextResponse.json(
        { error: `Record ${numericRecordId} does not exist on-chain.` },
        { status: 404 }
      );
    }

    if (ethers.getAddress(auth.address) !== ethers.getAddress(provider)) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the on-chain provider for this record can upload ciphertext.",
        },
        { status: 403 }
      );
    }

    // Verify sha256(ciphertext) == contentHash == onChainHash
    const computedHash = await computeContentHash(ciphertext);
    const normalizedComputed = computedHash.toLowerCase();
    const normalizedInput = String(contentHash).toLowerCase();
    const normalizedOnChain = String(onChainHash).toLowerCase();

    if (
      normalizedComputed !== normalizedInput ||
      normalizedComputed !== normalizedOnChain
    ) {
      return NextResponse.json(
        {
          error:
            "Content hash mismatch. sha256(ciphertext) must match both provided contentHash and on-chain contentHash.",
          computed: normalizedComputed,
          provided: normalizedInput,
          onChain: normalizedOnChain,
        },
        { status: 400 }
      );
    }

    // Store ciphertext in Supabase
    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from("blobs").upsert({
      record_id: numericRecordId,
      ciphertext,
      iv,
      content_hash: normalizedComputed,
    });

    if (dbError) {
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordId: numericRecordId,
      contentHash: normalizedComputed,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/blob?recordId=
 * Fetches encrypted medical record ciphertext.
 * Permitted only if caller has active on-chain access (HealthVault.hasAccess).
 * Unauthorized or revoked callers receive 403 Forbidden.
 */
export async function GET(req: NextRequest) {
  const auth = verifyAuthHeaders(req.headers, "GET", "/api/blob");
  if (!auth.valid || !auth.address) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const recordIdParam = searchParams.get("recordId");
  if (!recordIdParam) {
    return NextResponse.json(
      { error: "Query parameter 'recordId' is required." },
      { status: 400 }
    );
  }

  const numericRecordId = Number(recordIdParam);
  if (isNaN(numericRecordId)) {
    return NextResponse.json(
      { error: "Invalid recordId format." },
      { status: 400 }
    );
  }

  try {
    // Check on-chain access rights
    const contract = getHealthVaultContract();
    const hasAccess = await contract.hasAccess(numericRecordId, auth.address);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Caller does not have active on-chain access to this record (unauthorized or expired).",
        },
        { status: 403 }
      );
    }

    // Fetch blob from Supabase
    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("blobs")
      .select("*")
      .eq("record_id", numericRecordId)
      .single();

    if (dbError || !data) {
      return NextResponse.json(
        { error: `Record blob ${numericRecordId} not found in database.` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      recordId: data.record_id,
      ciphertext: data.ciphertext,
      iv: data.iv,
      contentHash: data.content_hash,
      createdAt: data.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

