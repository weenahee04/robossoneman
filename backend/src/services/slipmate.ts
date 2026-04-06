const SLIPMATE_VERIFY_URL = 'https://api.slipmate.ai/open-api/v1/verify';

export interface SlipMateVerifyPayload {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface SlipMatePartyInfo {
  displayName?: string | null;
  name?: string | null;
  proxy?: {
    type?: string | null;
    typeName?: string | null;
    value?: string | null;
  } | null;
  account?: {
    type?: string | null;
    value?: string | null;
  } | null;
}

export interface SlipMateVerifyResult {
  transRef: string;
  sendingBank?: string | null;
  sendingBankName?: string | null;
  receivingBank?: string | null;
  receivingBankName?: string | null;
  transDate?: string | null;
  transTime?: string | null;
  transDateTime?: string | null;
  sender?: SlipMatePartyInfo | null;
  receiver?: SlipMatePartyInfo | null;
  amount: number;
  paidLocalAmount?: number | null;
  paidLocalCurrency?: string | null;
  countryCode?: string | null;
  transFeeAmount?: number | null;
  ref1?: string | null;
  ref2?: string | null;
  ref3?: string | null;
  toMerchantId?: string | null;
  raw: Record<string, unknown>;
}

function getSlipMateApiKey() {
  const apiKey = process.env.SLIPMATE_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('SlipMate API key is not configured');
  }
  return apiKey;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asPartyInfo(value: unknown): SlipMatePartyInfo | null {
  if (!isRecord(value)) {
    return null;
  }

  const proxy = isRecord(value.proxy)
    ? {
        type: typeof value.proxy.type === 'string' ? value.proxy.type : null,
        typeName: typeof value.proxy.typeName === 'string' ? value.proxy.typeName : null,
        value: typeof value.proxy.value === 'string' ? value.proxy.value : null,
      }
    : null;
  const account = isRecord(value.account)
    ? {
        type: typeof value.account.type === 'string' ? value.account.type : null,
        value: typeof value.account.value === 'string' ? value.account.value : null,
      }
    : null;

  return {
    displayName: typeof value.displayName === 'string' ? value.displayName : null,
    name: typeof value.name === 'string' ? value.name : null,
    proxy,
    account,
  };
}

function asNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

export async function verifySlipWithSlipMate(
  payload: SlipMateVerifyPayload
): Promise<SlipMateVerifyResult> {
  const form = new FormData();
  const blob = new Blob([payload.bytes], { type: payload.mimeType || 'application/octet-stream' });
  form.set('file', blob, payload.fileName || 'slip.jpg');
  form.set('allowDuplicate', 'true');

  const response = await fetch(SLIPMATE_VERIFY_URL, {
    method: 'POST',
    headers: {
      'X-API-KEY': getSlipMateApiKey(),
    },
    body: form,
  });

  const rawText = await response.text();
  const json = rawText ? (JSON.parse(rawText) as unknown) : null;

  if (!response.ok) {
    const message =
      isRecord(json) && typeof json.message === 'string'
        ? json.message
        : `SlipMate verify failed with status ${response.status}`;
    throw new Error(message);
  }

  if (!isRecord(json)) {
    throw new Error('SlipMate returned an invalid response');
  }

  const transRef = typeof json.transRef === 'string' ? json.transRef : null;
  const amount = asNumber(json.amount);

  if (!transRef || amount === null) {
    throw new Error('SlipMate response is missing required transaction data');
  }

  return {
    transRef,
    sendingBank: typeof json.sendingBank === 'string' ? json.sendingBank : null,
    sendingBankName: typeof json.sendingBankName === 'string' ? json.sendingBankName : null,
    receivingBank: typeof json.receivingBank === 'string' ? json.receivingBank : null,
    receivingBankName: typeof json.receivingBankName === 'string' ? json.receivingBankName : null,
    transDate: typeof json.transDate === 'string' ? json.transDate : null,
    transTime: typeof json.transTime === 'string' ? json.transTime : null,
    transDateTime: typeof json.transDateTime === 'string' ? json.transDateTime : null,
    sender: asPartyInfo(json.sender),
    receiver: asPartyInfo(json.receiver),
    amount,
    paidLocalAmount: asNumber(json.paidLocalAmount),
    paidLocalCurrency: typeof json.paidLocalCurrency === 'string' ? json.paidLocalCurrency : null,
    countryCode: typeof json.countryCode === 'string' ? json.countryCode : null,
    transFeeAmount: asNumber(json.transFeeAmount),
    ref1: typeof json.ref1 === 'string' ? json.ref1 : null,
    ref2: typeof json.ref2 === 'string' ? json.ref2 : null,
    ref3: typeof json.ref3 === 'string' ? json.ref3 : null,
    toMerchantId: typeof json.toMerchantId === 'string' ? json.toMerchantId : null,
    raw: json,
  };
}
