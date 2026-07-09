import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://api.line.me/v2/bot';
const DATA_API_BASE = 'https://api-data.line.me/v2/bot';

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const index = line.indexOf('=');
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    let value = line.slice(index + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] ??= value.replace(/\\n/g, '\n');
  }
}

function requireAccessToken() {
  const token = process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is required');
  }
  return token;
}

function getCustomerPortalUrl() {
  return (
    process.env.LINE_CUSTOMER_PORTAL_URL?.trim() ||
    process.env.CUSTOMER_PORTAL_URL?.trim() ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    'http://localhost:5173'
  ).replace(/\/$/, '');
}

async function lineFetch(pathname: string, init: RequestInit = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireAccessToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    throw new Error(`LINE API failed ${res.status}: ${await res.text()}`);
  }

  if (res.status === 204) return null;
  return res.json();
}

function buildRichMenu() {
  const portal = getCustomerPortalUrl();
  const cellW = 833;
  const topH = 843;
  const bottomY = 843;

  return {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: 'ROBOSS Member Menu',
    chatBarText: 'ROBOSS Menu',
    areas: [
      {
        bounds: { x: 0, y: 0, width: cellW, height: topH },
        action: { type: 'postback', label: 'Points', data: 'action=points', displayText: 'เช็คพ้อย' },
      },
      {
        bounds: { x: cellW, y: 0, width: cellW, height: topH },
        action: { type: 'uri', label: 'Coupons', uri: `${portal}/coupon` },
      },
      {
        bounds: { x: cellW * 2, y: 0, width: 834, height: topH },
        action: { type: 'postback', label: 'Stamps', data: 'action=stamps', displayText: 'เช็คแสตมป์' },
      },
      {
        bounds: { x: 0, y: bottomY, width: cellW, height: 843 },
        action: { type: 'postback', label: 'Member', data: 'action=member', displayText: 'สมาชิกของฉัน' },
      },
      {
        bounds: { x: cellW, y: bottomY, width: cellW, height: 843 },
        action: { type: 'postback', label: 'Register', data: 'action=register', displayText: 'ลงทะเบียน ROBOSS' },
      },
      {
        bounds: { x: cellW * 2, y: bottomY, width: 834, height: 843 },
        action: { type: 'uri', label: 'Open App', uri: `${portal}/member` },
      },
    ],
  };
}

function contentTypeFromPath(filePath: string) {
  const lower = filePath.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  throw new Error('Rich menu image must be .jpg, .jpeg, or .png');
}

async function uploadRichMenuImage(richMenuId: string, imagePath: string) {
  const absolutePath = path.resolve(process.cwd(), imagePath);
  const body = fs.readFileSync(absolutePath);
  const res = await fetch(`${DATA_API_BASE}/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireAccessToken()}`,
      'Content-Type': contentTypeFromPath(absolutePath),
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`LINE image upload failed ${res.status}: ${await res.text()}`);
  }
}

async function main() {
  loadLocalEnv();

  const created = (await lineFetch('/richmenu', {
    method: 'POST',
    body: JSON.stringify(buildRichMenu()),
  })) as { richMenuId: string };

  console.log(`Created rich menu: ${created.richMenuId}`);

  const imagePath = process.env.LINE_RICH_MENU_IMAGE_PATH?.trim();
  if (imagePath) {
    await uploadRichMenuImage(created.richMenuId, imagePath);
    console.log(`Uploaded rich menu image: ${imagePath}`);
  } else {
    console.log('Skipped image upload. Set LINE_RICH_MENU_IMAGE_PATH to upload a 2500x1686 JPG/PNG.');
  }

  if (process.env.LINE_RICH_MENU_SET_DEFAULT === 'true') {
    await lineFetch(`/user/all/richmenu/${created.richMenuId}`, { method: 'POST' });
    console.log('Set rich menu as default for all users.');
  } else {
    console.log('Skipped default assignment. Set LINE_RICH_MENU_SET_DEFAULT=true when the image is uploaded.');
  }

  console.log(`Add this to env if you want to keep the id: LINE_RICH_MENU_ID=${created.richMenuId}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
