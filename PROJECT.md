# PROJECT.md — Veil Health

> Working name. Rename freely. **Read this whole file before writing any code. Follow it exactly. If something here is impossible, stop and tell me instead of silently changing the design.**

## 1. One-line pitch

**Your health, your key.** Pay for care, share records and get insurance claims paid without anyone seeing more than they need to.

## 2. The problem

Today you must expose your data to prove a fact. To get a claim paid you hand over the diagnosis. To change hospitals you hand over everything. Even a *payment* to a clinic can reveal a condition. People skip care because of stigma, hospitals leak records, and insurers lose money to fraud and then punish honest patients with paperwork.

Veil Health removes that trade-off:

- **Zcash shielded payments** hide who paid which clinic and how much.
- **Client-side encrypted records** mean no server or company can read them.
- **Scoped, time-limited access** lets a patient share one record with one doctor for a limited time and revoke it.
- **Provider-attested claims** let an insurer verify "a covered service by a licensed provider happened" without seeing the diagnosis or the record.
- **Zcash memos** reconcile every payment to a visit or claim privately.

Applies to everybody: patients with sensitive conditions, families managing relatives' care across countries, migrants needing portable records, employees who don't want employers to know, clinics that want faster payment, and insurers that want less fraud.

## 3. Hackathon rules checkpoint (do this first, tell me the result)

I have NOT confirmed the hackathon's required chain or tracks. The contract layer is deliberately isolated in `/contracts` so it can be ported. Default is Solidity on **Base Sepolia**. Ask me to confirm before deploying.

## 4. What is real vs simplified (be honest in the UI and README)

| Feature | Status |
|---|---|
| Client-side AES-GCM record encryption | **Real** |
| Key wrapping per recipient (ECDH P-256 + AES-GCM) | **Real** |
| Smart contract: roles, records, grants, expiry, policies, claims, payouts | **Real**, deployed on testnet |
| Provider attestation (signature verified on-chain with ecrecover) | **Real** |
| Access enforcement on the server using on-chain `hasAccess` | **Real** |
| Zcash shielded payments with memos | **Real if the spike in Section 11 passes**, else falls back to the mode described there |
| Zero-knowledge proofs of claim validity | **NOT built.** Replaced by provider signature attestation. Listed as roadmap. Do not claim ZK proofs in the UI. |
| Viewing-key audit | **Stretch goal** only |
| Real medical/regulatory compliance | **Not claimed.** Testnet demo only. |

Never display fake data as if it were live. Anything simulated must show a visible "SIMULATED" badge.

## 5. Roles and user stories

**Patient**
- Create vault (generates an encryption keypair, registers public key on-chain).
- See my records (decrypted locally), my grants, my claims, my access log.
- Grant a doctor access to ONE record for a chosen duration; revoke at any time.
- Pay a clinic privately in shielded testnet ZEC with a memo tying the payment to a visit.
- Submit an insurance claim for a record using a provider attestation.
- See insurer payouts arrive with a verified memo.

**Provider (clinic or doctor)**
- Registered by the admin (deployer). Create a visit record for a patient: encrypted for the patient and the provider, plus signed attestation of `(patient, recordId, procedureCode, amountCents)`.
- Show a payment request (Zcash address + memo) and see when paid.
- View a record only if the patient granted access (and it hasn't expired).

**Insurer**
- Registered by the admin. Create a policy for a patient (limit, covered procedure codes).
- See submitted claims with ONLY: procedure code, amount, provider, date, attestation validity. Never the record.
- Approve or reject; pay out in shielded ZEC with a memo; mark paid on-chain.

**Admin (deployer, one-time)**
- Registers provider and insurer addresses. No UI needed beyond a hidden `/admin` page.

## 6. Architecture

```
Browser (Next.js)
 ├─ WebCrypto: AES-GCM records, ECDH key wrapping
 ├─ ethers v6: calls HealthVault contract (Base Sepolia)
 ├─ ZcashAdapter: shielded send/receive with memos (WebZjs, testnet)
 └─ calls Next.js API routes
Next.js API routes (server)
 ├─ verifies wallet signature on each request
 ├─ checks HealthVault.hasAccess on-chain
 └─ stores/serves ciphertext + wrapped keys in Supabase
Supabase (free tier): Postgres for ciphertext blobs and key wraps
Base Sepolia: HealthVault.sol holds hashes, permissions, claims. NO medical data.
Zcash testnet: shielded value transfer + memo reconciliation
```

Rule: **no plaintext medical data ever leaves the browser. No medical data on-chain. No private keys on the server.**

## 7. Tech stack (all free tier, managed services preferred)

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- ethers v6
- Hardhat + OpenZeppelin contracts + TypeScript tests
- Supabase (Postgres) via `@supabase/supabase-js`, used **only from API routes** with the service role key
- `@chainsafe/webzjs-wallet` for Zcash
- Deploy: Vercel (frontend + API routes)
- Public RPC for Base Sepolia (`https://sepolia.base.org`) unless it rate-limits, then a free Alchemy/Infura key

## 8. Windows rules (important)

I work on **Windows using Command Prompt (cmd.exe) only**. Every command you give me must work in cmd.exe:
- Use `&&` to chain, `copy`, `del`, `mkdir`, `type`, `set VAR=value`. No `export`, no `rm`, no `touch`, no bash heredocs, no `chmod`.
- Paths use backslashes in commands.
- Laptop has about 8 GB RAM: no Docker, no running a Zcash full node, no heavy local services. Use hosted endpoints only.

## 9. Repository layout

```
veil-health/
  PROJECT.md
  README.md
  contracts/            (Hardhat project)
    contracts/HealthVault.sol
    test/HealthVault.test.ts
    scripts/deploy.ts
    scripts/register-roles.ts
    hardhat.config.ts
  web/                  (Next.js app)
    app/
      page.tsx                      landing + role picker
      patient/page.tsx
      provider/page.tsx
      insurer/page.tsx
      admin/page.tsx               hidden, registers roles
      api/blob/route.ts
      api/keywrap/route.ts
      api/fund/route.ts            tops up demo wallets with test ETH
    lib/
      chain.ts                     ethers provider, contract, ABI
      crypto.ts                    AES-GCM + ECDH wrap/unwrap
      identity.ts                  burner wallet + ECDH keypair in localStorage
      auth.ts                      sign/verify request messages
      zcash/adapter.ts             interface
      zcash/webzjs.ts              live implementation
      zcash/manual.ts              fallback: ZIP-321 request + txid entry
      zcash/sim.ts                 fallback: simulated, badge shown
      supabase.ts                  server only
    components/                    shared UI
  supabase/schema.sql
```

## 10. Smart contract spec — `HealthVault.sol`

Solidity ^0.8.24, OpenZeppelin `Ownable`, `ECDSA`, `MessageHashUtils`.

**Enums / constants**
- `ProcedureCode` (uint8): 0 OUTPATIENT, 1 LAB, 2 IMAGING, 3 SPECIALIST, 4 PHARMACY, 5 DENTAL, 6 EYE, 7 EMERGENCY. Categories are intentionally coarse (data minimisation: insurer learns the coverage category, not the diagnosis).
- `ClaimStatus`: Submitted, Approved, Rejected, Paid.

**Storage**
- `mapping(address => bool) isProvider; mapping(address => bool) isInsurer;`
- `mapping(address => bytes) publicKeyOf;` ECDH P-256 public key (raw/JWK-encoded bytes) for any registered address.
- `Record { address patient; address provider; bytes32 contentHash; uint64 createdAt; }` in `mapping(uint256 => Record)`, with `nextRecordId`.
- `mapping(uint256 => mapping(address => uint64)) accessExpiry;` recordId => grantee => unix expiry.
- `Policy { address insurer; address patient; uint256 limitCents; uint256 usedCents; uint16 coveredBitmap; bool active; }` in `mapping(uint256 => Policy)`.
- `Claim { uint256 policyId; uint256 recordId; address patient; address provider; uint8 code; uint256 amountCents; ClaimStatus status; bytes32 payoutRef; uint64 submittedAt; }` in `mapping(uint256 => Claim)`.
- `mapping(uint256 => bool) recordClaimed;` one claim per record.

**Functions**
- `setProvider(address, bool)`, `setInsurer(address, bool)` — onlyOwner.
- `registerKey(bytes pubKey)` — anyone, sets `publicKeyOf[msg.sender]`.
- `createRecord(address patient, bytes32 contentHash) returns (uint256 recordId)` — onlyProvider. Emits `RecordCreated`.
- `grantAccess(uint256 recordId, address grantee, uint64 expiry)` — only record's patient; expiry must be in the future and at most 30 days ahead. Emits `AccessGranted`.
- `revokeAccess(uint256 recordId, address grantee)` — only patient. Emits `AccessRevoked`.
- `hasAccess(uint256 recordId, address who) view returns (bool)` — true if `who` is the record's patient, the record's provider, or has an unexpired grant.
- `logAccess(uint256 recordId)` — callable by anyone with `hasAccess` who is not the patient; emits `AccessLogged(recordId, msg.sender, timestamp)`. This is the patient's access log.
- `createPolicy(address patient, uint256 limitCents, uint16 coveredBitmap) returns (uint256 policyId)` — onlyInsurer.
- `submitClaim(uint256 policyId, uint256 recordId, uint8 code, uint256 amountCents, bytes providerSig) returns (uint256 claimId)` — only the record's patient. Requirements: policy active and belongs to this patient; code covered by bitmap; `usedCents + amountCents <= limitCents`; record not already claimed; signature verifies. Signature check: digest = `keccak256(abi.encodePacked(address(this), block.chainid, patient, recordId, code, amountCents))`, wrapped with `MessageHashUtils.toEthSignedMessageHash`, recovered signer must equal the record's provider and `isProvider[signer]`. Emits `ClaimSubmitted`.
- `reviewClaim(uint256 claimId, bool approve)` — only the policy's insurer, only when Submitted. On approve, adds amount to `usedCents`.
- `markPaid(uint256 claimId, bytes32 payoutRef)` — only the policy's insurer, only when Approved. `payoutRef = keccak256(utf8 memo string)` used on Zcash payout. Emits `ClaimPaid`.

**Events:** `RecordCreated`, `AccessGranted`, `AccessRevoked`, `AccessLogged`, `PolicyCreated`, `ClaimSubmitted`, `ClaimReviewed`, `ClaimPaid`, `KeyRegistered`.

**Use custom errors, not require strings.**

**Tests (Hardhat, must pass):** role gating; create record; grant, expiry, revoke, `hasAccess` before and after expiry using time travel; claim with valid signature passes; claim with a signature from a non-provider fails; wrong amount (signature mismatch) fails; code not covered fails; over limit fails; duplicate claim for a record fails; review and markPaid state machine; only correct parties can call each function.

## 11. Zcash layer

### Adapter interface (`lib/zcash/adapter.ts`)

```ts
export interface ZcashAdapter {
  mode: "live" | "manual" | "sim";
  init(): Promise<void>;
  getAddress(): Promise<string>;          // shielded unified address
  getBalance(): Promise<{ zec: string }>;
  send(to: string, zec: string, memo: string): Promise<{ txid: string }>;
  listReceived(): Promise<Array<{ txid: string; zec: string; memo: string; time: number }>>;
}
```

The UI only talks to this interface and always shows the active mode as a badge: LIVE TESTNET, MANUAL, or SIMULATED.

### Memo conventions
- Visit payment: `VH-VISIT-<recordId>`
- Claim payout: `VH-CLAIM-<claimId>`
- `payoutRef` on-chain = `keccak256` of the claim memo string. The patient's app recomputes it from the memo it received and shows "Payment verified" only if it matches the on-chain `payoutRef`.

### Spike first (before building any Zcash UI)
Goal: prove one real shielded testnet send with a memo and one receive with that memo decrypted, from the browser, using `@chainsafe/webzjs-wallet`. Notes:
- WebZjs needs the Wasm module and thread pool initialised exactly once per page load, and needs a gRPC-web lightwalletd proxy URL.
- WebZjs uses a thread pool, which usually needs cross-origin isolation headers (`Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`) configured in `next.config.js`. If Next.js fights this, build the Zcash piece as a small separate Vite page.
- I have not verified that a hosted **testnet** gRPC-web proxy exists. Find one, or tell me. Do not ask me to run Docker.
- Testnet funds from a faucet (`https://testnet.zecfaucet.com/`). I will fund the wallets manually.

Decision after the spike (tell me which one happened):
1. **live**: WebZjs works on testnet. Use `webzjs.ts`.
2. **manual**: WebZjs fails. The app shows a ZIP-321 payment request (address, amount, memo) as text and QR for a testnet wallet app, and the payer pastes the resulting txid. The recipient confirms receipt in their own wallet and enters the memo. Label it MANUAL.
3. **sim**: last resort, clearly badged SIMULATED, so the rest of the product is still demonstrable.

Do not spend more than about 45 minutes on the spike.

## 12. Crypto spec (`lib/crypto.ts`) — WebCrypto only, no custom crypto

- Record key `K`: random AES-GCM 256 key per record, random 12-byte IV, ciphertext stored with IV (base64).
- Identity keypair: ECDH P-256 generated once per role wallet, stored in localStorage as JWK. Public key registered on-chain via `registerKey`.
- Wrapping `K` for a recipient: generate an ephemeral ECDH keypair, derive a shared secret with the recipient's public key, HKDF to an AES-GCM key, encrypt raw `K`. Store `{ephemeralPublicKeyJwk, iv, wrappedKey}`.
- `contentHash` on-chain = SHA-256 of the ciphertext bytes (so any tampering is detectable).
- Record plaintext is JSON: `{ title, date, provider, notes, vitals?, attachments? }`. Max size 200 KB. No file uploads beyond text/JSON in v1.

## 13. Data model (Supabase, `supabase/schema.sql`)

```sql
create table blobs (
  record_id bigint primary key,
  ciphertext text not null,
  iv text not null,
  content_hash text not null,
  created_at timestamptz default now()
);
create table key_wraps (
  record_id bigint not null,
  grantee text not null,            -- lowercase address
  ephemeral_pub text not null,
  iv text not null,
  wrapped_key text not null,
  created_at timestamptz default now(),
  primary key (record_id, grantee)
);
alter table blobs enable row level security;
alter table key_wraps enable row level security;
-- no public policies: only the service role (API routes) may access.
```

## 14. API routes (server)

Every request carries `x-address`, `x-ts` (unix seconds, must be within 5 minutes) and `x-sig` (signature of `VeilHealth:<METHOD>:<path>:<ts>` by `x-address`). Server recovers the signer and rejects mismatches.

- `POST /api/blob` — body `{recordId, ciphertext, iv, contentHash}`. Allowed only if the signer is the record's provider on-chain, and `sha256(ciphertext) == contentHash == on-chain contentHash`.
- `GET /api/blob?recordId=` — allowed only if `HealthVault.hasAccess(recordId, signer)` is true on-chain right now.
- `POST /api/keywrap` — body `{recordId, grantee, ephemeralPub, iv, wrappedKey}`. Allowed if the signer is the record's patient, or the record's provider when wrapping for the patient and provider at creation.
- `GET /api/keywrap?recordId=` — returns only the signer's own wrap, and only if `hasAccess` is true.
- `DELETE /api/keywrap?recordId=&grantee=` — signer must be the patient. Called on revoke.
- `POST /api/fund` — sends a small amount of Base Sepolia ETH from a funded server key to a demo wallet that has under a threshold balance. Rate-limit by address. Server key is in env, never exposed.

## 15. Identity for the demo

For a 5-hour build, each role uses an in-browser **burner wallet** (ethers `Wallet.createRandom()` stored in localStorage) plus the ECDH keypair. A role switcher on the landing page lets me open the Patient, Provider, or Insurer view. Show the address, and a "Fund wallet" button that calls `/api/fund`. Include "Export / Import demo identity" (paste private key) so a role can be reused across browsers. Warn clearly: demo wallets, testnet only, never use real funds.

## 16. UI spec

**Style:** dark mode, minimal, modern SaaS. Near-black background (`#0B0B0E`), subtle borders, soft cards, **Zcash amber accent `#F4B728`**, large readable type. Headings in Fraunces (serif), body in Inter. Calm and trustworthy, not "crypto-bro". Mobile friendly (judges may open it on a phone). No emoji clutter. Use clear empty states, loading skeletons, and error toasts.

**Always visible:** active role, address (shortened), network badge (Base Sepolia), Zcash mode badge.

**Landing:** pitch, three role cards, a short "how privacy works" strip (3 icons: encrypted, shielded, scoped access), a link to the README.

**Patient dashboard tabs:** Records · Share · Claims · Payments · Access log.
- Records: list with decrypt-on-click, "decrypted locally" label.
- Share: choose a record, enter grantee address, choose duration (1h, 24h, 48h, 7d), confirm. List active grants with countdown and Revoke button.
- Claims: eligible records (with provider attestation) → pick policy → submit. Status tracker per claim.
- Payments: pay a clinic (address, amount, memo auto-filled `VH-VISIT-<id>`); received payouts with a green "Payment verified" chip when the memo hash matches on-chain.
- Access log: reads `AccessLogged` events, shows who/when for each record.

**Provider dashboard tabs:** New visit · Records · Payments.
- New visit: patient address, title, notes, procedure code, amount. On submit: encrypt, `createRecord`, upload blob, wrap keys, sign attestation, show a payment-request card.
- Records: only those the provider created, plus any shared with them; viewing a shared record triggers `logAccess`.

**Insurer dashboard tabs:** Policies · Claims.
- Policies: create (patient address, limit, covered codes checkboxes).
- Claims: table showing ONLY claim id, code, amount, provider, status, "attestation valid ✓". There must be no way to open the record. Approve/Reject buttons, then Pay (Zcash send with memo `VH-CLAIM-<id>`) and automatic `markPaid`.

**Privacy panel (judges love this):** a "What the insurer / public chain / server can see" 3-column comparison on the claim and payment screens, with real values from the current transaction.

## 17. Seed and demo setup

Provide `scripts/seed.ts` (run with ts-node or via an npm script) that, after deploy, registers one provider, one insurer, funds roles, and creates one sample policy so the demo starts quickly. Provide a README section "Run the demo in 3 minutes".

## 18. Definition of done (all must be true)

1. `npx hardhat test` passes in `contracts`.
2. Contract deployed to Base Sepolia, address and ABI wired into the app via env/`lib/chain.ts`.
3. Provider creates a visit; the Supabase blob contains only ciphertext (verify in the Supabase dashboard).
4. Patient decrypts the record in the browser.
5. Patient grants a doctor 1-hour access; doctor reads it; the access log shows it; after revoke, the doctor's fetch is rejected by the API (tested).
6. A grant with a short expiry actually fails after expiry (tested with a 2-minute grant at least once manually).
7. Patient submits a claim with a valid attestation; a tampered amount is rejected by the contract (tested).
8. Insurer reviews with no access to the record (verified: the API returns 403 for the insurer).
9. Insurer pays through the active Zcash adapter with memo `VH-CLAIM-<id>`; the patient's UI shows "Payment verified" only when the memo hash matches `payoutRef`.
10. Zcash mode badge is truthful.
11. Deployed on Vercel, works on a phone screen, with a README and a demo video script.

## 19. Scope cuts (do NOT build these now)

Emergency break-glass access, ZK proofs, file/image uploads, multi-hospital interoperability, employer analytics, research data marketplace, real KYC, real regulatory compliance, key rotation on revoke, mobile app. Mention them on a roadmap slide only.

## 20. Coding rules for the agent

- TypeScript strict mode. No `any` unless commented why.
- Small commits and a short summary after each task, with exact cmd.exe commands to run and what I should see.
- Never put secrets in client code. Only `NEXT_PUBLIC_` vars are client-visible. Provide `.env.example` files.
- If a library API is unclear (especially WebZjs), read its docs/source instead of guessing, and tell me what you verified.
- When something fails, report the real error and the fix. Do not hide failures behind mocks. If you mock, badge it SIMULATED.
- After each phase, run the relevant tests and tell me the result honestly.

## 21. 3-minute demo script

1. Hook (20s): "A payment record can reveal a diagnosis. So can a file. We fixed both."
2. Provider creates a visit; show Supabase holding only ciphertext (20s).
3. Patient pays privately in shielded ZEC; show the public explorer revealing nothing useful (30s).
4. Patient grants a doctor 1-hour access to one record; doctor reads it; the access log updates; revoke (40s).
5. Patient submits a claim; insurer sees only code, amount, provider, and "attestation valid" (30s).
6. Insurer pays in shielded ZEC with a memo; patient sees "Payment verified" (25s).
7. Close (15s): "Prove what's needed. Reveal nothing more." Show the roadmap: ZK claim proofs, viewing-key audits, multi-clinic networks.

