import { NextRequest, NextResponse } from "next/server";
import { verifyAuthHeaders } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getHealthVaultContract } from "@/lib/chain";
import { ethers } from "ethers";

/**
 * POST /api/keywrap
 * Stores a wrapped AES record key for a recipient.
 * Permitted only if:
 * 1. Caller signature is verified within 5-minute window
 * 2. Caller is the record's patient OR
 *    Caller is the record's provider wrapping for the patient or provider at creation
 */
export async function POST(req: NextRequest) {
  const auth = verifyAuthHeaders(req.headers, "POST", "/api/keywrap");
  if (!auth.valid || !auth.address) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { recordId, grantee, ephemeralPub, iv, wrappedKey } = body;

    if (
      recordId === undefined ||
      recordId === null ||
      !grantee ||
      !ephemeralPub ||
      !iv ||
      !wrappedKey
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: recordId, grantee, ephemeralPub, iv, wrappedKey.",
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

    if (!ethers.isAddress(grantee)) {
      return NextResponse.json(
        { error: "Invalid grantee Ethereum address." },
        { status: 400 }
      );
    }

    const granteeNormalized = ethers.getAddress(grantee);

    // Verify on-chain record and caller authority
    const contract = getHealthVaultContract();
    const onChainRecord = await contract.records(numericRecordId);
    const [patient, provider] = onChainRecord;

    if (!patient || patient === ethers.ZeroAddress) {
      return NextResponse.json(
        { error: `Record ${numericRecordId} does not exist on-chain.` },
        { status: 404 }
      );
    }

    const isPatient =
      ethers.getAddress(auth.address) === ethers.getAddress(patient);
    const isProvider =
      ethers.getAddress(auth.address) === ethers.getAddress(provider);

    if (!isPatient && !isProvider) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the record's patient or provider can store key wraps.",
        },
        { status: 403 }
      );
    }

    // If caller is provider, they may only wrap for patient or themselves at creation
    if (isProvider && !isPatient) {
      const allowedGrantee =
        granteeNormalized === ethers.getAddress(patient) ||
        granteeNormalized === ethers.getAddress(provider);
      if (!allowedGrantee) {
        return NextResponse.json(
          {
            error:
              "Forbidden: Provider may only upload key wraps for the patient or provider at creation.",
          },
          { status: 403 }
        );
      }
    }

    const ephemeralPubStr =
      typeof ephemeralPub === "string"
        ? ephemeralPub
        : JSON.stringify(ephemeralPub);

    // Save key wrap in Supabase
    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase.from("key_wraps").upsert({
      record_id: numericRecordId,
      grantee: granteeNormalized.toLowerCase(),
      ephemeral_pub: ephemeralPubStr,
      iv,
      wrapped_key: wrappedKey,
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
      grantee: granteeNormalized,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/keywrap?recordId=
 * Fetches the caller's OWN wrapped key for a record.
 * Permitted only if caller has active on-chain access (HealthVault.hasAccess).
 * Unauthorized or revoked callers receive 403 Forbidden.
 */
export async function GET(req: NextRequest) {
  const auth = verifyAuthHeaders(req.headers, "GET", "/api/keywrap");
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
    // Check on-chain access
    const contract = getHealthVaultContract();
    const hasAccess = await contract.hasAccess(numericRecordId, auth.address);

    if (!hasAccess) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Caller does not have active on-chain access to this record.",
        },
        { status: 403 }
      );
    }

    // Retrieve caller's key wrap only
    const supabase = getSupabaseAdmin();
    const { data, error: dbError } = await supabase
      .from("key_wraps")
      .select("*")
      .eq("record_id", numericRecordId)
      .eq("grantee", auth.address.toLowerCase())
      .single();

    if (dbError || !data) {
      return NextResponse.json(
        {
          error: `No wrapped key found for caller on record ${numericRecordId}.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      recordId: data.record_id,
      grantee: data.grantee,
      ephemeralPub: data.ephemeral_pub,
      iv: data.iv,
      wrappedKey: data.wrapped_key,
      createdAt: data.created_at,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/keywrap?recordId=&grantee=
 * Deletes a recipient's wrapped key upon access revocation.
 * Permitted only if caller is the record's patient on-chain.
 */
export async function DELETE(req: NextRequest) {
  const auth = verifyAuthHeaders(req.headers, "DELETE", "/api/keywrap");
  if (!auth.valid || !auth.address) {
    return NextResponse.json(
      { error: auth.error || "Unauthorized" },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const recordIdParam = searchParams.get("recordId");
  const granteeParam = searchParams.get("grantee");

  if (!recordIdParam || !granteeParam) {
    return NextResponse.json(
      {
        error:
          "Query parameters 'recordId' and 'grantee' are required for deletion.",
      },
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

  if (!ethers.isAddress(granteeParam)) {
    return NextResponse.json(
      { error: "Invalid grantee address format." },
      { status: 400 }
    );
  }

  const granteeNormalized = ethers.getAddress(granteeParam);

  try {
    // Only the patient may delete key wraps on revocation
    const contract = getHealthVaultContract();
    const onChainRecord = await contract.records(numericRecordId);
    const [patient] = onChainRecord;

    if (!patient || patient === ethers.ZeroAddress) {
      return NextResponse.json(
        { error: `Record ${numericRecordId} does not exist on-chain.` },
        { status: 404 }
      );
    }

    if (ethers.getAddress(auth.address) !== ethers.getAddress(patient)) {
      return NextResponse.json(
        {
          error:
            "Forbidden: Only the record's patient can delete key wraps on revoke.",
        },
        { status: 403 }
      );
    }

    const supabase = getSupabaseAdmin();
    const { error: dbError } = await supabase
      .from("key_wraps")
      .delete()
      .eq("record_id", numericRecordId)
      .eq("grantee", granteeNormalized.toLowerCase());

    if (dbError) {
      return NextResponse.json(
        { error: `Database error: ${dbError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      recordId: numericRecordId,
      grantee: granteeNormalized,
      revoked: true,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

