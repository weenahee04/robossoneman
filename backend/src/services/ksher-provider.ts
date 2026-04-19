/**
 * Ksher Payment Provider
 *
 * Implements the PaymentProvider interface using the Ksher SDK
 * (https://github.com/ksher-solutions/ksher_sdk_nodejs).
 *
 * Uses the Native Pay API to generate PromptPay Dynamic QR codes
 * and Order Query API for status reconciliation.
 *
 * Ksher API docs: https://api.ksher.net/KsherAPI/dev/index.html
 */

import type {
  PaymentProvider,
  ProviderCreatePaymentResult,
  ProviderStatusSnapshot,
  ProviderWebhookSignal,
} from './payment-provider.js';

// ---------------------------------------------------------------------------
// Types for Ksher SDK / API responses
// ---------------------------------------------------------------------------

type KsherDataSuccess = {
  result: 'SUCCESS';
  mch_order_no: string;
  ksher_order_no: string;
  code_url?: string;
  imgdat?: string;
  trade_type?: string;
  total_fee?: number;
  fee_type?: string;
  appid?: string;
  PaymentCode?: string;
  [key: string]: unknown;
};

type KsherDataFail = {
  result: 'FAIL' | 'NOTSURE';
  err_code?: string;
  err_msg?: string;
  nonce_str?: string;
  [key: string]: unknown;
};

type KsherApiResponse = {
  code: number;
  msg: string;
  sign?: string;
  version?: string;
  status_code?: string;
  status_msg?: string;
  time_stamp?: string;
  data: KsherDataSuccess | KsherDataFail;
};

type KsherOrderQueryData = KsherDataSuccess & {
  result: string;
  channel?: string;
  openid?: string;
  channel_order_no?: string;
  cash_fee?: number;
  cash_fee_type?: string;
  time_end?: string;
  operation?: string;
  rate?: number | string;
  attach?: string;
  order_no?: string;
};

type KsherWebhookPayload = {
  code: number;
  version?: string;
  status_code?: string;
  msg?: string;
  time_stamp?: string;
  status_msg?: string;
  sign?: string;
  data: {
    result: string;
    mch_order_no: string;
    ksher_order_no?: string;
    total_fee?: number;
    fee_type?: string;
    channel?: string;
    appid?: string;
    time_end?: string;
    order_no?: string;
    openid?: string;
    cash_fee?: number;
    cash_fee_type?: string;
    operation?: string;
    [key: string]: unknown;
  };
};

type ProviderWebhookInput = {
  rawBody: string;
  headers: Record<string, string | undefined>;
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

// ---------------------------------------------------------------------------
// Ksher SDK wrapper
// ---------------------------------------------------------------------------

let KsherPayClass: any = null;

async function getKsherSdk() {
  if (!KsherPayClass) {
    // The Ksher SDK uses CommonJS — dynamic import for ESM compatibility
    const mod = await import('@kshersolution/ksher');
    KsherPayClass = mod.default ?? mod;
  }

  const appId = process.env.KSHER_APP_ID?.trim();
  const privateKey = process.env.KSHER_PRIVATE_KEY?.trim();

  if (!appId) {
    throw new Error('KSHER_APP_ID environment variable is required');
  }

  if (!privateKey) {
    throw new Error('KSHER_PRIVATE_KEY environment variable is required');
  }

  // The SDK accepts either a file path or the PEM string directly
  // We pass the PEM string (with \n replaced for multi-line env vars)
  const pemKey = privateKey.replace(/\\n/g, '\n');
  return new KsherPayClass(appId, pemKey);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Ksher uses satang (integer) for total_fee.
 * 150.50 THB → 15050
 */
function toSatang(amount: number): string {
  return String(Math.round(amount * 100));
}

/**
 * Convert Ksher total_fee (satang) back to THB.
 * 15050 → 150.50
 */
function fromSatang(satang: number): number {
  return satang / 100;
}

/**
 * Map Ksher order query result to a normalized status string
 * that the existing payment-flow.ts can understand.
 *
 * Ksher result values (from Order Query API docs):
 *   SUCCESS, FAIL, CLOSED, NOTPAY, PAYERROR, PENDING, NOTSURE, USERPAYING, REFUND
 */
function mapKsherStatus(result: string): string {
  switch (result?.toUpperCase()) {
    case 'SUCCESS':
      return 'succeeded';
    case 'FAIL':
    case 'CLOSED':
    case 'PAYERROR':
      return 'failed';
    case 'REFUND':
      return 'refunded';
    case 'NOTPAY':
    case 'PENDING':
    case 'NOTSURE':
    case 'USERPAYING':
    default:
      return 'pending';
  }
}

// ---------------------------------------------------------------------------
// KsherPaymentProvider
// ---------------------------------------------------------------------------

export class KsherPaymentProvider implements PaymentProvider {
  readonly name = 'ksher';
  readonly liveMode = true;

  /**
   * Create a PromptPay Dynamic QR using Ksher Native Pay API.
   *
   * API endpoint: POST https://api.mch.ksher.net/KsherPay/native_pay
   */
  async createPayment(input: ProviderPaymentContext): Promise<ProviderCreatePaymentResult> {
    const sdk = await getKsherSdk();

    const notifyUrl = process.env.KSHER_NOTIFY_URL?.trim() || '';

    const requestData: Record<string, string> = {
      mch_order_no: input.reference,
      total_fee: toSatang(input.amount),
      fee_type: input.currency?.toUpperCase() || 'THB',
      channel: 'promptpay',
    };

    if (notifyUrl) {
      requestData.notify_url = notifyUrl;
    }

    // Optionally pass product description
    requestData.product = `Payment for session ${input.sessionId}`;

    // Attach metadata so we can trace back
    requestData.attach = JSON.stringify({
      sessionId: input.sessionId,
      paymentId: input.id,
    });

    let response: KsherApiResponse;
    try {
      response = await sdk.native_pay(requestData);
    } catch (error: any) {
      console.error('[Ksher] native_pay error:', error?.message ?? error);
      throw new Error(`Ksher native_pay failed: ${error?.message ?? 'unknown error'}`);
    }

    // Validate response
    if (response.code !== 0) {
      const errMsg = response.status_msg || response.msg || 'Unknown error';
      console.error('[Ksher] native_pay non-zero code:', response);
      throw new Error(`Ksher native_pay returned error: ${errMsg}`);
    }

    const data = response.data;
    if (data.result !== 'SUCCESS') {
      const failData = data as KsherDataFail;
      const errMsg = failData.err_msg || failData.err_code || 'Unknown failure';
      console.error('[Ksher] native_pay FAIL:', failData);
      throw new Error(`Ksher native_pay failed: ${errMsg}`);
    }

    const successData = data as KsherDataSuccess;

    // Ksher returns QR data in two possible fields:
    //   - `imgdat`: pre-rendered base64 PNG image of the QR code (already a displayable image)
    //   - `code_url`: raw EMVCo/PromptPay payload string (needs to be encoded into QR by frontend)
    //
    // For PromptPay, Ksher typically returns `imgdat`.
    // If imgdat is present, we send it as a pre-rendered QR image via metadata.qrContext.qrImageUrl
    // (same path Stripe uses), so the frontend displays it directly.
    // If only code_url is present, we use it as qrPayload for the frontend to encode.

    const hasImgdat = !!successData.imgdat;
    const imgdatUrl = hasImgdat
      ? (successData.imgdat!.startsWith('data:')
          ? successData.imgdat!
          : `data:image/png;base64,${successData.imgdat}`)
      : null;

    // qrPayload priority:
    //   1. code_url — a scannable PromptPay/EMVCo string the frontend can render into a QR
    //   2. imgdat data-URI — so the frontend qrPayload null-check still passes and
    //      resolveStripeQrImage() will pick up the image from qrContext
    const qrPayload = successData.code_url || imgdatUrl || null;

    return {
      providerName: this.name,
      providerRef: successData.ksher_order_no,
      providerStatus: 'pending',
      reference: successData.mch_order_no,
      qrPayload,
      expiresAt: input.expiresAt,
      metadata: {
        ksher_order_no: successData.ksher_order_no,
        trade_type: successData.trade_type,
        code_url: successData.code_url,
        imgdat: successData.imgdat ? '[present]' : null,
        PaymentCode: successData.PaymentCode,
        // qrContext matches the shape that frontend resolveStripeQrImage() reads:
        //   metadata.paymentQrContext.qrImageUrl
        qrContext: imgdatUrl ? { qrImageUrl: imgdatUrl } : null,
      },
    };
  }

  /**
   * Parse Ksher Notify URL webhook.
   *
   * Ksher sends the webhook as `text/plain;charset=utf-8` with JSON body.
   * Ksher only notifies on SUCCESS.
   *
   * The merchant must respond with:
   *   {"result": "SUCCESS", "msg": "OK"}
   *
   * API docs: https://api.ksher.net/KsherAPI/dev/apis/notify_url.html
   */
  async parseWebhook(input: ProviderWebhookInput): Promise<ProviderWebhookSignal> {
    let payload: KsherWebhookPayload;
    try {
      payload = JSON.parse(input.rawBody) as KsherWebhookPayload;
    } catch {
      throw new Error('Ksher webhook body is not valid JSON');
    }

    if (!payload.data) {
      throw new Error('Ksher webhook missing data field');
    }

    const data = payload.data;
    const mchOrderNo = data.mch_order_no || data.order_no;
    if (!mchOrderNo) {
      throw new Error('Ksher webhook missing mch_order_no');
    }

    // Parse attach field to get sessionId/paymentId if available
    let attachData: Record<string, string> = {};
    if (typeof data.attach === 'string' && data.attach.trim()) {
      try {
        attachData = JSON.parse(data.attach);
      } catch {
        // attach might not be JSON, that's OK
      }
    }

    const totalFee = typeof data.total_fee === 'number' ? data.total_fee : undefined;

    return {
      providerName: this.name,
      paymentId: attachData.paymentId || undefined,
      sessionId: attachData.sessionId || undefined,
      reference: mchOrderNo,
      providerRef: data.ksher_order_no || undefined,
      providerStatus: mapKsherStatus(data.result),
      amount: totalFee !== undefined ? fromSatang(totalFee) : undefined,
      currency: data.fee_type?.toUpperCase() || 'THB',
      eventId: data.ksher_order_no || undefined,
      occurredAt: data.time_end ? new Date(data.time_end) : undefined,
      requestBody: payload as unknown as Record<string, unknown>,
      raw: payload as unknown as Record<string, unknown>,
    };
  }

  /**
   * Fetch payment status using Ksher Order Query API.
   *
   * API endpoint: POST https://api.mch.ksher.net/KsherPay/order_query
   */
  async fetchPaymentStatus(input: ProviderPaymentContext): Promise<ProviderStatusSnapshot | null> {
    const sdk = await getKsherSdk();

    const queryData: Record<string, string> = {
      mch_order_no: input.reference,
    };

    let response: KsherApiResponse;
    try {
      response = await sdk.order_query(queryData);
    } catch (error: any) {
      console.error('[Ksher] order_query error:', error?.message ?? error);
      return null;
    }

    if (response.code !== 0) {
      console.error('[Ksher] order_query non-zero code:', response);
      return null;
    }

    const data = response.data;
    if (data.result === 'FAIL') {
      const failData = data as KsherDataFail;
      // KSHER_INVALID_ORDER_NO means the order doesn't exist
      if (failData.err_code === 'KSHER_INVALID_ORDER_NO') {
        return null;
      }
    }

    const queryResults = data as KsherOrderQueryData;
    const totalFee = typeof queryResults.total_fee === 'number' ? queryResults.total_fee : undefined;

    return {
      providerName: this.name,
      providerRef: queryResults.ksher_order_no || undefined,
      providerStatus: mapKsherStatus(queryResults.result),
      amount: totalFee !== undefined ? fromSatang(totalFee) : undefined,
      currency: queryResults.fee_type?.toUpperCase() || 'THB',
      occurredAt: queryResults.time_end ? new Date(queryResults.time_end) : undefined,
      raw: response as unknown as Record<string, unknown>,
    };
  }
}
