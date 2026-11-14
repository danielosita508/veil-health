// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title HealthVault
 * @notice Scoped health records, identity key registration, access control,
 *         and private insurance claims with provider attestation.
 */
contract HealthVault is Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // --- Enums & Constants ---
    enum ProcedureCode {
        OUTPATIENT,  // 0
        LAB,          // 1
        IMAGING,      // 2
        SPECIALIST,   // 3
        PHARMACY,     // 4
        DENTAL,       // 5
        EYE,          // 6
        EMERGENCY     // 7
    }

    enum ClaimStatus {
        Submitted, // 0
        Approved,  // 1
        Rejected,  // 2
        Paid       // 3
    }

    uint64 public constant MAX_GRANT_DURATION = 30 days;

    // --- Custom Errors ---
    error Unauthorized();
    error OnlyProvider();
    error OnlyInsurer();
    error OnlyPatient();
    error InvalidAddress();
    error InvalidExpiry();
    error RecordNotFound();
    error PolicyNotFound();
    error PolicyInactive();
    error PolicyLimitExceeded();
    error ProcedureNotCovered();
    error RecordAlreadyClaimed();
    error InvalidAttestationSignature();
    error ClaimNotFound();
    error InvalidClaimStatus();

    // --- Structs ---
    struct Record {
        address patient;
        address provider;
        bytes32 contentHash;
        uint64 createdAt;
    }

    struct Policy {
        address insurer;
        address patient;
        uint256 limitCents;
        uint256 usedCents;
        uint16 coveredBitmap;
        bool active;
    }

    struct Claim {
        uint256 policyId;
        uint256 recordId;
        address patient;
        address provider;
        uint8 code;
        uint256 amountCents;
        ClaimStatus status;
        bytes32 payoutRef;
        uint64 submittedAt;
    }

    // --- Storage ---
    mapping(address => bool) public isProvider;
    mapping(address => bool) public isInsurer;
    mapping(address => bytes) public publicKeyOf;

    uint256 public nextRecordId = 1;
    mapping(uint256 => Record) public records;

    // recordId => grantee => unix expiry
    mapping(uint256 => mapping(address => uint64)) public accessExpiry;

    uint256 public nextPolicyId = 1;
    mapping(uint256 => Policy) public policies;

    uint256 public nextClaimId = 1;
    mapping(uint256 => Claim) public claims;

    // One claim per record
    mapping(uint256 => bool) public recordClaimed;

    // --- Events ---
    event RecordCreated(
        uint256 indexed recordId,
        address indexed patient,
        address indexed provider,
        bytes32 contentHash
    );
    event AccessGranted(
        uint256 indexed recordId,
        address indexed patient,
        address indexed grantee,
        uint64 expiry
    );
    event AccessRevoked(
        uint256 indexed recordId,
        address indexed patient,
        address indexed grantee
    );
    event AccessLogged(
        uint256 indexed recordId,
        address indexed caller,
        uint64 timestamp
    );
    event PolicyCreated(
        uint256 indexed policyId,
        address indexed insurer,
        address indexed patient,
        uint256 limitCents,
        uint16 coveredBitmap
    );
    event ClaimSubmitted(
        uint256 indexed claimId,
        uint256 indexed policyId,
        uint256 indexed recordId,
        address patient,
        uint8 code,
        uint256 amountCents
    );
    event ClaimReviewed(uint256 indexed claimId, bool approved);
    event ClaimPaid(uint256 indexed claimId, bytes32 payoutRef);
    event KeyRegistered(address indexed account, bytes pubKey);

    constructor() Ownable(msg.sender) {}

    // --- Role Management ---
    function setProvider(address account, bool active) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        isProvider[account] = active;
    }

    function setInsurer(address account, bool active) external onlyOwner {
        if (account == address(0)) revert InvalidAddress();
        isInsurer[account] = active;
    }

    // --- Key Registration ---
    function registerKey(bytes calldata pubKey) external {
        publicKeyOf[msg.sender] = pubKey;
        emit KeyRegistered(msg.sender, pubKey);
    }

    // --- Records & Access Control ---
    function createRecord(
        address patient,
        bytes32 contentHash
    ) external returns (uint256 recordId) {
        if (!isProvider[msg.sender]) revert OnlyProvider();
        if (patient == address(0)) revert InvalidAddress();

        recordId = nextRecordId++;
        records[recordId] = Record({
            patient: patient,
            provider: msg.sender,
            contentHash: contentHash,
            createdAt: uint64(block.timestamp)
        });

        emit RecordCreated(recordId, patient, msg.sender, contentHash);
    }

    function grantAccess(
        uint256 recordId,
        address grantee,
        uint64 expiry
    ) external {
        Record storage rec = records[recordId];
        if (rec.patient == address(0)) revert RecordNotFound();
        if (msg.sender != rec.patient) revert OnlyPatient();
        if (grantee == address(0)) revert InvalidAddress();

        if (expiry <= block.timestamp || expiry > block.timestamp + MAX_GRANT_DURATION) {
            revert InvalidExpiry();
        }

        accessExpiry[recordId][grantee] = expiry;
        emit AccessGranted(recordId, msg.sender, grantee, expiry);
    }

    function revokeAccess(uint256 recordId, address grantee) external {
        Record storage rec = records[recordId];
        if (rec.patient == address(0)) revert RecordNotFound();
        if (msg.sender != rec.patient) revert OnlyPatient();

        delete accessExpiry[recordId][grantee];
        emit AccessRevoked(recordId, msg.sender, grantee);
    }

    function hasAccess(uint256 recordId, address who) public view returns (bool) {
        Record storage rec = records[recordId];
        if (rec.patient == address(0)) return false;
        if (who == rec.patient || who == rec.provider) return true;

        uint64 expiry = accessExpiry[recordId][who];
        return expiry > block.timestamp;
    }

    function logAccess(uint256 recordId) external {
        Record storage rec = records[recordId];
        if (rec.patient == address(0)) revert RecordNotFound();
        if (msg.sender == rec.patient) revert Unauthorized();
        if (!hasAccess(recordId, msg.sender)) revert Unauthorized();

        emit AccessLogged(recordId, msg.sender, uint64(block.timestamp));
    }

    // --- Policies & Claims ---
    function createPolicy(
        address patient,
        uint256 limitCents,
        uint16 coveredBitmap
    ) external returns (uint256 policyId) {
        if (!isInsurer[msg.sender]) revert OnlyInsurer();
        if (patient == address(0)) revert InvalidAddress();

        policyId = nextPolicyId++;
        policies[policyId] = Policy({
            insurer: msg.sender,
            patient: patient,
            limitCents: limitCents,
            usedCents: 0,
            coveredBitmap: coveredBitmap,
            active: true
        });

        emit PolicyCreated(policyId, msg.sender, patient, limitCents, coveredBitmap);
    }

    function submitClaim(
        uint256 policyId,
        uint256 recordId,
        uint8 code,
        uint256 amountCents,
        bytes calldata providerSig
    ) external returns (uint256 claimId) {
        Record storage rec = records[recordId];
        if (rec.patient == address(0)) revert RecordNotFound();

        Policy storage pol = policies[policyId];
        if (pol.insurer == address(0)) revert PolicyNotFound();

        if (msg.sender != rec.patient || rec.patient != pol.patient) {
            revert OnlyPatient();
        }
        if (!pol.active) revert PolicyInactive();
        if (recordClaimed[recordId]) revert RecordAlreadyClaimed();
        if (pol.usedCents + amountCents > pol.limitCents) revert PolicyLimitExceeded();

        // Bitmap coverage check
        if (code >= 8 || ((pol.coveredBitmap >> code) & 1) == 0) {
            revert ProcedureNotCovered();
        }

        // Provider attestation verification:
        // digest = keccak256(abi.encodePacked(address(this), block.chainid, patient, recordId, code, amountCents))
        bytes32 digest = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                rec.patient,
                recordId,
                code,
                amountCents
            )
        );
        bytes32 ethSignedDigest = digest.toEthSignedMessageHash();
        address recoveredSigner = ethSignedDigest.recover(providerSig);

        if (recoveredSigner != rec.provider || !isProvider[recoveredSigner]) {
            revert InvalidAttestationSignature();
        }

        recordClaimed[recordId] = true;
        claimId = nextClaimId++;

        claims[claimId] = Claim({
            policyId: policyId,
            recordId: recordId,
            patient: rec.patient,
            provider: rec.provider,
            code: code,
            amountCents: amountCents,
            status: ClaimStatus.Submitted,
            payoutRef: bytes32(0),
            submittedAt: uint64(block.timestamp)
        });

        emit ClaimSubmitted(claimId, policyId, recordId, rec.patient, code, amountCents);
    }

    function reviewClaim(uint256 claimId, bool approve) external {
        Claim storage clm = claims[claimId];
        if (clm.patient == address(0)) revert ClaimNotFound();

        Policy storage pol = policies[clm.policyId];
        if (msg.sender != pol.insurer) revert OnlyInsurer();
        if (clm.status != ClaimStatus.Submitted) revert InvalidClaimStatus();

        if (approve) {
            if (pol.usedCents + clm.amountCents > pol.limitCents) {
                revert PolicyLimitExceeded();
            }
            pol.usedCents += clm.amountCents;
            clm.status = ClaimStatus.Approved;
        } else {
            clm.status = ClaimStatus.Rejected;
        }

        emit ClaimReviewed(claimId, approve);
    }

    function markPaid(uint256 claimId, bytes32 payoutRef) external {
        Claim storage clm = claims[claimId];
        if (clm.patient == address(0)) revert ClaimNotFound();

        Policy storage pol = policies[clm.policyId];
        if (msg.sender != pol.insurer) revert OnlyInsurer();
        if (clm.status != ClaimStatus.Approved) revert InvalidClaimStatus();

        clm.status = ClaimStatus.Paid;
        clm.payoutRef = payoutRef;

        emit ClaimPaid(claimId, payoutRef);
    }
}
