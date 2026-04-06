import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWashCommandPayload, parseQrPayload } from '../src/services/wash-flow.js';
import { buildPaymentReference, normalizeProviderStatus } from '../src/services/payment-flow.js';
import {
  buildSessionPaymentQrContext,
  buildSessionPaymentQrPayload,
} from '../src/services/payment-provider.js';
import {
  createMachineScanToken,
  hashScanToken,
  verifyMachineScanToken,
} from '../src/services/scan-tokens.js';
import {
  buildBranchPaymentConfigSummary,
  decryptBranchPaymentCredential,
  encryptBranchPaymentCredential,
  maskCredentialValue,
  resolveBranchPaymentTarget,
} from '../src/services/branch-payment-config.js';

test('parseQrPayload supports app URI format', () => {
  assert.deepEqual(parseQrPayload('roboss://branch-01/machine-09'), {
    branchId: 'branch-01',
    machineId: 'machine-09',
  });
});

test('parseQrPayload supports legacy delimited format', () => {
  assert.deepEqual(parseQrPayload('roboss|branch-01|machine-09'), {
    branchId: 'branch-01',
    machineId: 'machine-09',
  });
});

test('parseQrPayload supports JSON format', () => {
  assert.deepEqual(parseQrPayload('{"branchId":"branch-01","machineId":"machine-09"}'), {
    branchId: 'branch-01',
    machineId: 'machine-09',
  });
});

test('parseQrPayload rejects invalid payloads', () => {
  assert.equal(parseQrPayload('hello-world'), null);
});

test('normalizeProviderStatus maps common provider variants', () => {
  assert.equal(normalizeProviderStatus('success'), 'confirmed');
  assert.equal(normalizeProviderStatus('declined'), 'failed');
  assert.equal(normalizeProviderStatus('canceled'), 'cancelled');
  assert.equal(normalizeProviderStatus('timeout'), 'expired');
  assert.equal(normalizeProviderStatus('unknown'), 'pending');
});

test('createMachineScanToken produces a verifiable signed token', () => {
  process.env.JWT_SECRET = 'scan-token-test-secret-at-least-32-chars';

  const { token, payload: createdPayload } = createMachineScanToken({
    branchId: 'branch-01',
    machineId: 'machine-09',
    machineCode: 'A1',
    nonce: 'abc123def456ghi789',
    issuedAt: 1_800_000_000,
    expiresAt: 1_800_000_300,
  });

  const verified = verifyMachineScanToken(token);

  assert.deepEqual(verified.payload, {
    v: 1,
    branchId: createdPayload.branchId,
    machineId: createdPayload.machineId,
    machineCode: createdPayload.machineCode,
    issuedAt: createdPayload.issuedAt,
    expiresAt: createdPayload.expiresAt,
    nonce: createdPayload.nonce,
  });
  assert.equal(verified.tokenHash, hashScanToken(token));
});

test('verifyMachineScanToken rejects tampered tokens', () => {
  process.env.JWT_SECRET = 'scan-token-test-secret-at-least-32-chars';

  const { token } = createMachineScanToken({
    branchId: 'branch-01',
    machineId: 'machine-09',
    issuedAt: 1_800_000_000,
    expiresAt: 1_800_000_300,
    nonce: 'nonce-value-123456',
  });

  const [payload] = token.split('.');
  const tamperedToken = `${payload}.broken-signature`;

  assert.throws(() => verifyMachineScanToken(tamperedToken), /signature is invalid/i);
});

test('branch payment credentials can be encrypted and decrypted', () => {
  process.env.BRANCH_PAYMENT_CREDENTIAL_SECRET = 'branch-payment-secret-at-least-32-chars';

  const encrypted = encryptBranchPaymentCredential('0891234567');

  assert.notEqual(encrypted, '0891234567');
  assert.equal(decryptBranchPaymentCredential(encrypted), '0891234567');
});

test('maskCredentialValue preserves non-secret values and masks secrets', () => {
  assert.equal(maskCredentialValue('0891234567', false), '0891234567');
  assert.equal(maskCredentialValue('sk_test_123456', true), 'sk**********56');
});

test('resolveBranchPaymentTarget maps promptpay_manual config to promptpay destination and adapter', () => {
  process.env.BRANCH_PAYMENT_CREDENTIAL_SECRET = 'branch-payment-secret-at-least-32-chars';

  const target = resolveBranchPaymentTarget({
    provider: 'promptpay_manual',
    displayName: 'Rama 9 PromptPay',
    statementName: 'ROBOSS Rama 9',
    credentials: [
      {
        key: 'promptpay_id',
        valueEncrypted: encryptBranchPaymentCredential('0891234567'),
      },
      {
        key: 'promptpay_name',
        valueEncrypted: encryptBranchPaymentCredential('ROBOSS Rama 9'),
      },
    ],
  });

  assert.equal(target.adapterName, 'mock_promptpay');
  assert.equal(target.paymentQrType, 'promptpay_manual');
  assert.equal(target.promptPayId, '0891234567');
  assert.equal(target.promptPayName, 'ROBOSS Rama 9');
});

test('buildBranchPaymentConfigSummary includes governance fields', () => {
  const summary = buildBranchPaymentConfigSummary({
    id: 'cfg-1',
    branchId: 'branch-1',
    mode: 'manual_promptpay',
    provider: 'promptpay_manual',
    isActive: true,
    isLocked: true,
    approvalStatus: 'approved',
    approvedAt: new Date('2026-04-04T08:00:00.000Z'),
    approvedByAdminId: 'admin-1',
    displayName: 'Branch PromptPay',
    statementName: 'ROBOSS Branch',
    settlementOwnerType: 'franchisee',
    createdAt: new Date('2026-04-04T08:00:00.000Z'),
    updatedAt: new Date('2026-04-04T08:00:00.000Z'),
    credentials: [],
    capabilities: null,
  });

  assert.equal(summary.isLocked, true);
  assert.equal(summary.approvalStatus, 'approved');
  assert.equal(summary.approvedByAdminId, 'admin-1');
});

test('buildPaymentReference includes branch, machine, date, and stable suffix', () => {
  const reference = buildPaymentReference({
    branchCode: 'rama9',
    machineCode: 'a1',
    sessionId: 'sess-1234-abcd',
    issuedAt: new Date('2026-04-04T08:00:00.000Z'),
    salt: 'sess-1234-abcd',
  });

  assert.match(reference, /^RB-RAMA9-A1-260404-[A-F0-9]{4}$/);
});

test('buildSessionPaymentQrPayload encodes payment context into URI', () => {
  const payload = buildSessionPaymentQrPayload({
    type: 'promptpay_manual',
    providerName: 'mock_promptpay',
    branchId: 'branch_c02',
    sessionId: 'sess_123',
    reference: 'RB-RAMA9-A1-260404-ABCD',
    amount: 149,
    currency: 'THB',
    expiresAt: new Date('2026-04-04T08:05:00.000Z'),
    promptPayId: '0891234567',
    promptPayName: 'ROBOSS Rama 9',
  });

  assert.match(payload, /^promptpay:\/\/pay\?/);
  assert.match(payload, /reference=RB-RAMA9-A1-260404-ABCD/);
  assert.match(payload, /sessionId=sess_123/);
});

test('buildSessionPaymentQrContext preserves traceable payment metadata', () => {
  const context = buildSessionPaymentQrContext({
    type: 'provider_dynamic',
    providerName: 'generic_rest',
    branchId: 'branch_c04',
    sessionId: 'sess_456',
    reference: 'RB-CHON-A2-260404-1A2B',
    amount: 199,
    currency: 'THB',
    expiresAt: new Date('2026-04-04T08:05:00.000Z'),
    promptPayId: '0899999999',
    promptPayName: 'ROBOSS Chonburi',
  });

  assert.equal(context.providerName, 'generic_rest');
  assert.equal(context.sessionId, 'sess_456');
  assert.equal(context.reference, 'RB-CHON-A2-260404-1A2B');
  assert.equal(context.recipient.id, '0899999999');
});

test('buildWashCommandPayload includes session, payment, reference, and scan token identifiers', () => {
  const payload = buildWashCommandPayload({
    sessionId: 'sess_123',
    paymentId: 'pay_123',
    reference: 'RB-RAMA9-A1-260404-ABCD',
    scanTokenId: 'scan_123',
    packageId: 'pkg_quick',
    carSize: 'M',
  });

  assert.deepEqual(payload, {
    sessionId: 'sess_123',
    paymentId: 'pay_123',
    reference: 'RB-RAMA9-A1-260404-ABCD',
    scanTokenId: 'scan_123',
    packageId: 'pkg_quick',
    carSize: 'M',
  });
});
