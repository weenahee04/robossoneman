import crypto from 'node:crypto';
import Stripe from 'stripe';
import { z } from 'zod';
import { resolveManualConfirmEnabled } from '../lib/config.js';

type ProviderHeaders = Record<string, string | undefined>;

type ProviderWebhookInput = {
  rawBody: string;
  headers: ProviderHeaders;
};

type ProviderPaymentContext = {
  id?: string;
  sessionId: string;
  userId: string;
  branchId: string;
  customerEmail?: string | null;
  branchPromptPayId: string;
  branchPromptPayName: string;
  amount: number;
  currency: string;
  reference: string;
  expiresAt: Date;
  providerRef?: string | null;
  provider?: string;
  metadata?: Record<string, unknown>;
};

export type SessionPaymentQrContext = {
  version: 1;
  type: 'promptpay_manual' | 'provider_dynamic';
  providerName: string;
  branchId: string;
  sessionId: string;
  reference: string;
  amount: number;
  currency: string;
  expiresAt: string;
  recipient: {
    id: string;
    name: string;
  };
};

export type ProviderCreatePaymentResult = {
  providerName: string;
  providerRef?: string | null;
  providerStatus: string;
  reference?: string | null;
  qrPayload?: string | null;
  expiresAt?: Date | null;
  metadata?: Record<string, unknown>;
};

export type ProviderStatusSnapshot = {
  providerName: string;
  providerRef?: string | null;
  providerStatus: string;
  amount?: number;
  currency?: string;
  occurredAt?: Date;
  raw?: Record<string, unknown>;
};

export type ProviderWebhookSignal = ProviderStatusSnapshot & {
  paymentId?: string;
  sessionId?: string;
  reference?: string;
  eventId?: string;
  requestBody?: Record<string, unknown>;
};

export interface PaymentProvider {
  readonly name: string;
  readonly liveMode: boolean;
  createPayment(input: ProviderPaymentContext): Promise<ProviderCreatePaymentResult>;
  parseWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookSignal>;
  fetchPaymentStatus(input: ProviderPaymentContext): Promise<ProviderStatusSnapshot | null>;
}

const genericWebhookSchema = z
  .object({
    paymentId: z.string().min(1).optional(),
    sessionId: z.string().min(1).optional(),
    reference: z.string().min(1).optional(),
    providerRef: z.string().min(1).optional(),
    providerStatus: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    amount: z.number().int().positive().optional(),
    currency: z.string().min(3).optional(),
    eventId: z.string().min(1).optional(),
    occurredAt: z.string().datetime().optional(),
  })
  .passthrough();

function envNumber(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getHeader(headers: ProviderHeaders, name: string) {
  const target = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return entry?.[1];
}

function safeJsonParse(rawBody: string) {
  if (!rawBody) {
    return {};
  }

  return JSON.parse(rawBody) as Record<string, unknown>;
}

function parseDate(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      return undefined;
    }
    return current[segment];
  }, source);
}

function pickFirstString(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

function pickFirstNumber(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return undefined;
}

function pickFirstDate(source: Record<string, unknown>, paths: string[]) {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    const parsed = parseDate(value);
    if (parsed) {
      return parsed;
    }
  }

  return undefined;
}

function buildPromptPayPayload(promptPayId: string, amount: number) {
  return `${promptPayId}|${amount.toFixed(2)}`;
}

function isZeroDecimalCurrency(currency: string) {
  const normalizedCurrency = currency.trim().toLowerCase();
  return new Set([
    'bif',
    'clp',
    'djf',
    'gnf',
    'jpy',
    'kmf',
    'krw',
    'mga',
    'pyg',
    'rwf',
    'ugx',
    'vnd',
    'vuv',
    'xaf',
    'xof',
    'xpf',
  ]).has(normalizedCurrency);
}

function toMinorAmount(amount: number, currency: string) {
  return isZeroDecimalCurrency(currency) ? amount : amount * 100;
}

function fromMinorAmount(amount: number, currency: string) {
  return isZeroDecimalCurrency(currency) ? amount : amount / 100;
}

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is required for Stripe payment provider');
  }
  return secretKey;
}

function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is required for Stripe webhook verification');
  }
  return webhookSecret;
}

let stripeClient: Stripe | null = null;

function getStripeClient() {
  if (!stripeClient) {
    stripeClient = new Stripe(getStripeSecretKey());
  }

  return stripeClient;
}

export function buildSessionPaymentQrContext(input: {
  type: SessionPaymentQrContext['type'];
  providerName: string;
  branchId: string;
  sessionId: string;
  reference: string;
  amount: number;
  currency: string;
  expiresAt: Date;
  promptPayId: string;
  promptPayName: string;
}) {
  return {
    version: 1 as const,
    type: input.type,
    providerName: input.providerName,
    branchId: input.branchId,
    sessionId: input.sessionId,
    reference: input.reference,
    amount: input.amount,
    currency: input.currency,
    expiresAt: input.expiresAt.toISOString(),
    recipient: {
      id: input.promptPayId,
      name: input.promptPayName,
    },
  };
}

export function buildSessionPaymentQrPayload(input: {
  type: SessionPaymentQrContext['type'];
  providerName: string;
  branchId: string;
  sessionId: string;
  reference: string;
  amount: number;
  currency: string;
  expiresAt: Date;
  promptPayId: string;
  promptPayName: string;
}) {
  const search = new URLSearchParams({
    provider: input.providerName,
    branchId: input.branchId,
    sessionId: input.sessionId,
    reference: input.reference,
    recipient: input.promptPayId,
    recipientName: input.promptPayName,
    amount: input.amount.toFixed(2),
    currency: input.currency,
    expiresAt: input.expiresAt.toISOString(),
  });

  return `promptpay://pay?${search.toString()}`;
}

function normalizeSecretValue(value: string | undefined) {
  return value?.trim() || undefined;
}

function assertWebhookSecret(headers: ProviderHeaders) {
  const expectedSecret = normalizeSecretValue(process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET);
  if (!expectedSecret) {
    return;
  }

  const headerName = process.env.PAYMENT_PROVIDER_WEBHOOK_SECRET_HEADER || 'x-payment-webhook-secret';
  const receivedSecret = normalizeSecretValue(getHeader(headers, headerName));

  if (!receivedSecret || receivedSecret !== expectedSecret) {
    throw new Error('Invalid payment webhook secret');
  }
}

function assertWebhookSignature(rawBody: string, headers: ProviderHeaders) {
  const secret = normalizeSecretValue(process.env.PAYMENT_PROVIDER_SIGNATURE_SECRET);
  if (!secret) {
    return;
  }

  const headerName = process.env.PAYMENT_PROVIDER_SIGNATURE_HEADER || 'x-payment-signature';
  const expectedPrefix = process.env.PAYMENT_PROVIDER_SIGNATURE_PREFIX || '';
  const algorithm = process.env.PAYMENT_PROVIDER_SIGNATURE_ALGORITHM || 'sha256';
  const receivedSignature = normalizeSecretValue(getHeader(headers, headerName));

  if (!receivedSignature) {
    throw new Error('Missing payment webhook signature');
  }

  const computed = crypto.createHmac(algorithm, secret).update(rawBody).digest('hex');
  const expectedSignature = `${expectedPrefix}${computed}`;
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error('Invalid payment webhook signature');
  }
}

async function requestProvider<T>(
  url: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const timeout = envNumber('PAYMENT_PROVIDER_TIMEOUT_MS', 10000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });

    const text = await response.text();
    let parsed: unknown = {};

    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = { raw: text };
      }
    }

    if (!response.ok) {
      const message =
        isRecord(parsed) && typeof parsed.message === 'string' && parsed.message
          ? parsed.message
          : fallbackMessage;
      throw new Error(message);
    }

    return parsed as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildAuthHeaders() {
  const apiKey = process.env.PAYMENT_PROVIDER_API_KEY;
  if (!apiKey) {
    return {};
  }

  const headerName = process.env.PAYMENT_PROVIDER_AUTH_HEADER || 'Authorization';
  const scheme = process.env.PAYMENT_PROVIDER_AUTH_SCHEME || 'Bearer';
  const value = scheme ? `${scheme} ${apiKey}` : apiKey;
  return { [headerName]: value };
}

function resolveVerifyUrl(template: string, payment: ProviderPaymentContext) {
  return template
    .replaceAll(':providerRef', encodeURIComponent(payment.providerRef ?? ''))
    .replaceAll(':reference', encodeURIComponent(payment.reference))
    .replaceAll(':paymentId', encodeURIComponent(payment.id ?? ''))
    .replaceAll(':sessionId', encodeURIComponent(payment.sessionId));
}

function mapResponseToSnapshot(
  source: Record<string, unknown>,
  providerName: string
): ProviderStatusSnapshot {
  return {
    providerName,
    providerRef: pickFirstString(source, ['providerRef', 'paymentId', 'id', 'data.id', 'data.paymentId']) ?? null,
    providerStatus:
      pickFirstString(source, [
        'providerStatus',
        'status',
        'paymentStatus',
        'data.status',
        'data.paymentStatus',
        'event.status',
      ]) ?? 'pending',
    amount: pickFirstNumber(source, ['amount', 'data.amount', 'payment.amount']),
    currency: pickFirstString(source, ['currency', 'data.currency', 'payment.currency']),
    occurredAt: pickFirstDate(source, ['occurredAt', 'confirmedAt', 'updatedAt', 'event.occurredAt']),
    raw: source,
  };
}

class MockPromptPayProvider implements PaymentProvider {
  readonly name = process.env.PAYMENT_PROVIDER_NAME || 'mock_promptpay';
  readonly liveMode = false;

  async createPayment(input: ProviderPaymentContext): Promise<ProviderCreatePaymentResult> {
    const qrContext = buildSessionPaymentQrContext({
      type: 'promptpay_manual',
      providerName: this.name,
      branchId: input.branchId,
      sessionId: input.sessionId,
      reference: input.reference,
      amount: input.amount,
      currency: input.currency,
      expiresAt: input.expiresAt,
      promptPayId: input.branchPromptPayId,
      promptPayName: input.branchPromptPayName,
    });

    return {
      providerName: this.name,
      providerRef: null,
      providerStatus: 'pending',
      reference: input.reference,
      qrPayload: buildSessionPaymentQrPayload({
        type: 'promptpay_manual',
        providerName: this.name,
        branchId: input.branchId,
        sessionId: input.sessionId,
        reference: input.reference,
        amount: input.amount,
        currency: input.currency,
        expiresAt: input.expiresAt,
        promptPayId: input.branchPromptPayId,
        promptPayName: input.branchPromptPayName,
      }),
      expiresAt: input.expiresAt,
      metadata: {
        providerMode: 'mock',
        createRequest: {
          promptPayPayload: buildPromptPayPayload(input.branchPromptPayId, input.amount),
          reference: input.reference,
        },
        qrContext,
      },
    };
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookSignal> {
    assertWebhookSecret(input.headers);
    assertWebhookSignature(input.rawBody, input.headers);

    const parsed = genericWebhookSchema.parse(safeJsonParse(input.rawBody));
    return {
      providerName: this.name,
      paymentId: parsed.paymentId,
      sessionId: parsed.sessionId,
      reference: parsed.reference,
      providerRef: parsed.providerRef,
      providerStatus: parsed.providerStatus ?? parsed.status ?? 'pending',
      amount: parsed.amount,
      currency: parsed.currency,
      eventId: parsed.eventId,
      occurredAt: parsed.occurredAt ? new Date(parsed.occurredAt) : undefined,
      requestBody: parsed,
      raw: parsed,
    };
  }

  async fetchPaymentStatus(): Promise<ProviderStatusSnapshot | null> {
    return null;
  }
}

class GenericRestPaymentProvider implements PaymentProvider {
  readonly name = process.env.PAYMENT_PROVIDER_NAME || 'generic_rest';
  readonly liveMode = true;

  async createPayment(input: ProviderPaymentContext): Promise<ProviderCreatePaymentResult> {
    const createUrl = process.env.PAYMENT_PROVIDER_CREATE_URL;
    if (!createUrl) {
      throw new Error('PAYMENT_PROVIDER_CREATE_URL is required for live payment provider');
    }

    const payload = {
      merchantPaymentId: input.reference,
      reference: input.reference,
      sessionId: input.sessionId,
      branchId: input.branchId,
      userId: input.userId,
      amount: input.amount,
      currency: input.currency,
      expiresAt: input.expiresAt.toISOString(),
      callbackUrl: process.env.PAYMENT_PROVIDER_CALLBACK_URL || undefined,
      promptPay: {
        id: input.branchPromptPayId,
        name: input.branchPromptPayName,
      },
      metadata: {
        sessionId: input.sessionId,
        branchId: input.branchId,
        userId: input.userId,
        reference: input.reference,
        ...(input.metadata ?? {}),
      },
    };

    const response = await requestProvider<Record<string, unknown>>(
      createUrl,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...buildAuthHeaders(),
        },
        body: JSON.stringify(payload),
      },
      'Failed to create payment with provider'
    );

    const snapshot = mapResponseToSnapshot(response, this.name);

    const qrContext = buildSessionPaymentQrContext({
      type: 'provider_dynamic',
      providerName: this.name,
      branchId: input.branchId,
      sessionId: input.sessionId,
      reference: input.reference,
      amount: input.amount,
      currency: input.currency,
      expiresAt:
        pickFirstDate(response, ['expiresAt', 'data.expiresAt', 'payment.expiresAt']) ?? input.expiresAt,
      promptPayId: input.branchPromptPayId,
      promptPayName: input.branchPromptPayName,
    });

    return {
      providerName: this.name,
      providerRef: snapshot.providerRef,
      providerStatus: snapshot.providerStatus,
      reference:
        pickFirstString(response, ['reference', 'merchantPaymentId', 'data.reference']) ?? input.reference,
      qrPayload:
        pickFirstString(response, ['qrPayload', 'qrCode', 'qrString', 'payload', 'data.qrPayload']) ??
        buildPromptPayPayload(input.branchPromptPayId, input.amount),
      expiresAt:
        pickFirstDate(response, ['expiresAt', 'data.expiresAt', 'payment.expiresAt']) ?? input.expiresAt,
      metadata: {
        providerMode: 'live',
        createRequest: payload,
        createResponse: response,
        qrContext,
      },
    };
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookSignal> {
    assertWebhookSecret(input.headers);
    assertWebhookSignature(input.rawBody, input.headers);

    const parsed = safeJsonParse(input.rawBody);
    const snapshot = mapResponseToSnapshot(parsed, this.name);

    return {
      providerName: this.name,
      paymentId: pickFirstString(parsed, ['paymentId', 'data.paymentId', 'payment.id']),
      sessionId: pickFirstString(parsed, ['sessionId', 'metadata.sessionId', 'data.sessionId']),
      reference: pickFirstString(parsed, ['reference', 'merchantPaymentId', 'metadata.reference']),
      providerRef: snapshot.providerRef,
      providerStatus: snapshot.providerStatus,
      amount: snapshot.amount,
      currency: snapshot.currency,
      eventId: pickFirstString(parsed, ['eventId', 'id', 'event.id', 'data.eventId']),
      occurredAt:
        snapshot.occurredAt ??
        pickFirstDate(parsed, ['occurredAt', 'event.occurredAt', 'createdAt', 'updatedAt']),
      requestBody: parsed,
      raw: parsed,
    };
  }

  async fetchPaymentStatus(input: ProviderPaymentContext): Promise<ProviderStatusSnapshot | null> {
    const verifyUrlTemplate = process.env.PAYMENT_PROVIDER_VERIFY_URL;
    if (!verifyUrlTemplate) {
      return null;
    }

    const verifyUrl = resolveVerifyUrl(verifyUrlTemplate, input);
    const method = (process.env.PAYMENT_PROVIDER_VERIFY_METHOD || 'GET').toUpperCase();
    const includeBody = method !== 'GET';
    const body = includeBody
      ? JSON.stringify({
          paymentId: input.id,
          providerRef: input.providerRef,
          reference: input.reference,
          sessionId: input.sessionId,
          amount: input.amount,
          currency: input.currency,
        })
      : undefined;

    const response = await requestProvider<Record<string, unknown>>(
      verifyUrl,
      {
        method,
        headers: {
          ...(includeBody ? { 'content-type': 'application/json' } : {}),
          ...buildAuthHeaders(),
        },
        body,
      },
      'Failed to verify payment with provider'
    );

    return mapResponseToSnapshot(response, this.name);
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly name = 'stripe';
  readonly liveMode = !getStripeSecretKey().startsWith('sk_test_');

  async createPayment(input: ProviderPaymentContext): Promise<ProviderCreatePaymentResult> {
    const stripe = getStripeClient();
    const currency = input.currency.toLowerCase();
    const paymentIntent = await stripe.paymentIntents.create({
      amount: toMinorAmount(input.amount, currency),
      currency,
      payment_method_types: ['promptpay'],
      payment_method_data: {
        type: 'promptpay',
        billing_details: {
          email: input.customerEmail?.trim() || `${input.userId}@roboss.local`,
        },
      },
      confirm: true,
      metadata: {
        sessionId: input.sessionId,
        branchId: input.branchId,
        userId: input.userId,
        reference: input.reference,
      },
    });

    const qrAction = paymentIntent.next_action?.promptpay_display_qr_code;

    return {
      providerName: this.name,
      providerRef: paymentIntent.id,
      providerStatus: paymentIntent.status,
      reference: input.reference,
      qrPayload: qrAction?.data ?? null,
      expiresAt: input.expiresAt,
      metadata: {
        providerMode: this.liveMode ? 'live' : 'test',
        createRequest: {
          amount: input.amount,
          currency: input.currency,
          paymentMethodType: 'promptpay',
          reference: input.reference,
        },
        createResponse: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          clientSecret: paymentIntent.client_secret,
        },
        qrContext: {
          type: 'provider_dynamic',
          providerName: this.name,
          branchId: input.branchId,
          sessionId: input.sessionId,
          reference: input.reference,
          amount: input.amount,
          currency: input.currency,
          expiresAt: input.expiresAt.toISOString(),
          recipient: {
            id: input.branchPromptPayId,
            name: input.branchPromptPayName,
          },
          qrImageUrl: qrAction?.image_url_png ?? null,
          qrImageSvgUrl: qrAction?.image_url_svg ?? null,
          hostedInstructionsUrl: qrAction?.hosted_instructions_url ?? null,
        },
      },
    };
  }

  async parseWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookSignal> {
    const stripe = getStripeClient();
    const signature = getHeader(input.headers, 'stripe-signature');
    if (!signature) {
      throw new Error('Missing Stripe-Signature header');
    }

    const event = stripe.webhooks.constructEvent(input.rawBody, signature, getStripeWebhookSecret());
    const eventObject = event.data.object;
    if (eventObject.object !== 'payment_intent') {
      throw new Error(`Unsupported Stripe event object: ${eventObject.object}`);
    }

    const paymentIntent = eventObject as Stripe.PaymentIntent;
    return {
      providerName: this.name,
      sessionId: paymentIntent.metadata.sessionId || undefined,
      reference: paymentIntent.metadata.reference || undefined,
      providerRef: paymentIntent.id,
      providerStatus: paymentIntent.status,
      amount: fromMinorAmount(paymentIntent.amount, paymentIntent.currency),
      currency: paymentIntent.currency.toUpperCase(),
      eventId: event.id,
      occurredAt: new Date(event.created * 1000),
      requestBody: {
        type: event.type,
        providerRef: paymentIntent.id,
      },
      raw: event as unknown as Record<string, unknown>,
    };
  }

  async fetchPaymentStatus(input: ProviderPaymentContext): Promise<ProviderStatusSnapshot | null> {
    if (!input.providerRef) {
      return null;
    }

    const stripe = getStripeClient();
    const paymentIntent = await stripe.paymentIntents.retrieve(input.providerRef);
    return {
      providerName: this.name,
      providerRef: paymentIntent.id,
      providerStatus: paymentIntent.status,
      amount: fromMinorAmount(paymentIntent.amount, paymentIntent.currency),
      currency: paymentIntent.currency.toUpperCase(),
      occurredAt: paymentIntent.created ? new Date(paymentIntent.created * 1000) : undefined,
      raw: paymentIntent as unknown as Record<string, unknown>,
    };
  }
}

let providerSingleton: PaymentProvider | null = null;
let providerSingletonName: string | null = null;
const providerFactories = {
  mock_promptpay: () => new MockPromptPayProvider(),
  generic_rest: () => new GenericRestPaymentProvider(),
  stripe: () => new StripePaymentProvider(),
} satisfies Record<string, () => PaymentProvider>;

export function getSupportedPaymentProviderNames() {
  return Object.keys(providerFactories);
}

export function getPaymentProvider(providerNameOverride?: string) {
  const providerName = providerNameOverride || process.env.PAYMENT_PROVIDER_NAME || 'mock_promptpay';

  if (providerSingleton && providerSingletonName === providerName) {
    return providerSingleton;
  }

  const factory = providerFactories[providerName as keyof typeof providerFactories];
  if (!factory) {
    throw new Error(
      `Unsupported payment provider "${providerName}". Supported adapters: ${getSupportedPaymentProviderNames().join(', ')}`
    );
  }

  providerSingleton = factory();
  providerSingletonName = providerName;
  return providerSingleton;
}

export function isManualConfirmEnabled() {
  return resolveManualConfirmEnabled(process.env);
}
