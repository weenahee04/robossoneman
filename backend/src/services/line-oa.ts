import crypto from 'node:crypto';
import { prisma } from '../lib/prisma.js';

type LineMessage =
  | { type: 'text'; text: string }
  | { type: 'flex'; altText: string; contents: Record<string, unknown> };

type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

const LINE_REPLY_URL = 'https://api.line.me/v2/bot/message/reply';
const LINE_PROFILE_URL = 'https://api.line.me/v2/bot/profile';

function getMessagingAccessToken() {
  return process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN?.trim();
}

function getMessagingChannelSecret() {
  return (
    process.env.LINE_MESSAGING_CHANNEL_SECRET?.trim() ||
    process.env.LINE_CHANNEL_SECRET?.trim()
  );
}

export function getLineCustomerPortalUrl() {
  const explicit =
    process.env.LINE_CUSTOMER_PORTAL_URL?.trim() ||
    process.env.CUSTOMER_PORTAL_URL?.trim();

  if (explicit) return explicit.replace(/\/$/, '');

  const firstCorsOrigin = process.env.CORS_ORIGIN?.split(',')[0]?.trim();
  return (firstCorsOrigin || 'http://localhost:5173').replace(/\/$/, '');
}

export function verifyLineSignature(rawBody: string, signature?: string | null) {
  const channelSecret = getMessagingChannelSecret();
  if (!channelSecret || !signature) return false;

  const digest = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64');

  const expected = Buffer.from(digest);
  const actual = Buffer.from(signature);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function isLineOaConfigured() {
  return Boolean(getMessagingAccessToken() && getMessagingChannelSecret());
}

export async function replyLineMessages(replyToken: string, messages: LineMessage[]) {
  const accessToken = getMessagingAccessToken();
  if (!accessToken) {
    throw new Error('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not configured');
  }

  const res = await fetch(LINE_REPLY_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`LINE reply failed: ${res.status} ${body}`);
  }
}

export async function getLineProfile(lineUserId: string): Promise<LineProfile | null> {
  const accessToken = getMessagingAccessToken();
  if (!accessToken) return null;

  const res = await fetch(`${LINE_PROFILE_URL}/${encodeURIComponent(lineUserId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;
  return (await res.json()) as LineProfile;
}

async function ensureCustomerSidecars(userId: string, totalPoints = 0) {
  await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const existingStamp = await prisma.stamp.findFirst({
    where: { userId, rewardClaimed: false },
    select: { id: true },
  });
  if (!existingStamp) {
    await prisma.stamp.create({ data: { userId, targetCount: 10 } });
  }

  await prisma.pointWallet.upsert({
    where: { userId },
    update: {
      balance: totalPoints,
      lifetimeEarned: Math.max(totalPoints, 0),
    },
    create: {
      userId,
      balance: totalPoints,
      lifetimeEarned: Math.max(totalPoints, 0),
    },
  });

  await prisma.piggyBank.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

export async function ensureLineOaCustomer(lineUserId: string, profile?: LineProfile | null) {
  const resolvedProfile = profile ?? (await getLineProfile(lineUserId));
  const displayName = resolvedProfile?.displayName || 'ROBOSS LINE Customer';
  const avatarUrl = resolvedProfile?.pictureUrl || null;

  let user = await prisma.user.findUnique({ where: { lineUserId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        lineUserId,
        displayName,
        avatarUrl,
        settings: { create: {} },
      },
    });
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        displayName,
        avatarUrl: avatarUrl ?? user.avatarUrl,
        isActive: true,
        deactivatedAt: null,
      },
    });
  }

  await ensureCustomerSidecars(user.id, user.totalPoints);
  return user;
}

function money(value: number) {
  return `${value.toLocaleString('th-TH')} THB`;
}

function shortDate(value?: Date | string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function textBox(text: string, size = 'sm', weight: 'regular' | 'bold' = 'regular', color = '#FFFFFF') {
  return {
    type: 'text',
    text,
    size,
    weight,
    color,
    wrap: true,
  };
}

function actionButton(label: string, uri: string, style: 'primary' | 'secondary' = 'primary') {
  return {
    type: 'button',
    height: 'sm',
    style,
    color: style === 'primary' ? '#DC2626' : '#2A2A2A',
    action: { type: 'uri', label, uri },
  };
}

function baseBubble(params: {
  title: string;
  subtitle?: string;
  body: unknown[];
  footer?: unknown[];
}) {
  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: '#101010' },
      footer: { backgroundColor: '#101010' },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: 'ROBOSS',
          size: 'xs',
          weight: 'bold',
          color: '#DC2626',
        },
        {
          type: 'text',
          text: params.title,
          size: 'xl',
          weight: 'bold',
          color: '#FFFFFF',
          wrap: true,
        },
        ...(params.subtitle ? [textBox(params.subtitle, 'sm', 'regular', '#A3A3A3')] : []),
        { type: 'separator', color: '#2A2A2A', margin: 'md' },
        ...params.body,
      ],
    },
    footer: params.footer?.length
      ? {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: params.footer,
        }
      : undefined,
  };
}

function menuFlex() {
  const portal = getLineCustomerPortalUrl();
  return {
    type: 'flex' as const,
    altText: 'ROBOSS Member Menu',
    contents: baseBubble({
      title: 'เมนูสมาชิก ROBOSS',
      subtitle: 'เลือกข้อมูลที่ต้องการจาก Rich Menu หรือปุ่มด้านล่าง',
      body: [
        textBox('• เช็คพ้อยและประวัติคะแนน'),
        textBox('• ดูคูปองที่ใช้ได้'),
        textBox('• ดูแสตมป์และสิทธิ์ล้างฟรี'),
        textBox('• ดูแพ็กเกจสมาชิกที่ active'),
      ],
      footer: [
        actionButton('เปิด Member App', `${portal}/member`),
        actionButton('ดูคูปอง', `${portal}/coupon`, 'secondary'),
      ],
    }),
  };
}

async function buildPointsFlex(userId: string) {
  const [user, wallet, recent] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.pointWallet.findUnique({ where: { userId } }),
    prisma.pointsTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }),
  ]);

  const balance = wallet?.balance ?? user?.totalPoints ?? 0;
  const history = recent.length
    ? recent.map((item) => textBox(`${item.type} ${item.amount > 0 ? '+' : ''}${item.amount} pts - ${item.description}`, 'xs', 'regular', '#D4D4D4'))
    : [textBox('ยังไม่มีประวัติคะแนน', 'sm', 'regular', '#A3A3A3')];

  return {
    type: 'flex' as const,
    altText: `ROBOSS Points: ${balance}`,
    contents: baseBubble({
      title: `${balance.toLocaleString('th-TH')} Points`,
      subtitle: `Tier: ${user?.tier ?? 'bronze'}`,
      body: [
        textBox(`Lifetime earned: ${(wallet?.lifetimeEarned ?? balance).toLocaleString('th-TH')} pts`, 'sm', 'bold'),
        ...history,
      ],
      footer: [actionButton('เปิดหน้าสมาชิก', `${getLineCustomerPortalUrl()}/member`)],
    }),
  };
}

async function buildCouponsFlex(userId: string) {
  const coupons = await prisma.userCoupon.findMany({
    where: { userId, status: 'claimed' },
    include: { coupon: true },
    orderBy: { claimedAt: 'desc' },
    take: 8,
  });

  const activeCoupons = coupons.filter((item) => {
    const now = new Date();
    return item.coupon.status === 'active' && item.coupon.validFrom <= now && item.coupon.validUntil >= now;
  });

  const body = activeCoupons.length
    ? activeCoupons.slice(0, 5).map((item) => {
        const discount =
          item.coupon.discountType === 'percent'
            ? `${item.coupon.discountValue}%`
            : money(item.coupon.discountValue);
        return textBox(`${item.coupon.title} (${discount}) ใช้ได้ถึง ${shortDate(item.coupon.validUntil)}`, 'xs', 'regular', '#FFFFFF');
      })
    : [textBox('ตอนนี้ยังไม่มีคูปองที่ใช้ได้ กดรับคูปองในแอปหรือรอโปรใหม่จาก ROBOSS', 'sm', 'regular', '#A3A3A3')];

  return {
    type: 'flex' as const,
    altText: `ROBOSS Coupons: ${activeCoupons.length}`,
    contents: baseBubble({
      title: `คูปองใช้ได้ ${activeCoupons.length} ใบ`,
      subtitle: 'คูปองจะแสดงเฉพาะใบที่ยังไม่ใช้และยังไม่หมดอายุ',
      body,
      footer: [actionButton('เปิดคูปอง', `${getLineCustomerPortalUrl()}/coupon`)],
    }),
  };
}

async function buildStampsFlex(userId: string) {
  let stamp = await prisma.stamp.findFirst({
    where: { userId, rewardClaimed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!stamp) {
    stamp = await prisma.stamp.create({ data: { userId, targetCount: 10 } });
  }

  const progress = `${stamp.currentCount}/${stamp.targetCount}`;
  const ready = stamp.currentCount >= stamp.targetCount;
  return {
    type: 'flex' as const,
    altText: `ROBOSS Stamps: ${progress}`,
    contents: baseBubble({
      title: `Stamp ${progress}`,
      subtitle: ready ? 'สะสมครบแล้ว กดรับคูปองล้างฟรีในแอป' : `เหลือ ${Math.max(stamp.targetCount - stamp.currentCount, 0)} ดวง เพื่อรับล้างฟรี`,
      body: [
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'horizontal',
              contents: [
                {
                  type: 'box',
                  layout: 'vertical',
                  height: '10px',
                  width: `${Math.min(Math.max((stamp.currentCount / stamp.targetCount) * 100, 4), 100)}%`,
                  backgroundColor: ready ? '#16A34A' : '#DC2626',
                  contents: [],
                },
              ],
              backgroundColor: '#2A2A2A',
              cornerRadius: 'xxl',
            },
          ],
        },
        textBox('ครบ 10 ดวง รับคูปองล้างรถฟรี 1 ครั้ง', 'sm', 'bold'),
        textBox(`ล่าสุด: ${shortDate(stamp.lastStampAt)}`, 'xs', 'regular', '#A3A3A3'),
      ],
      footer: [actionButton(ready ? 'รับรางวัลในแอป' : 'ดูแสตมป์', `${getLineCustomerPortalUrl()}/stamp`)],
    }),
  };
}

async function buildMembershipFlex(userId: string) {
  const memberships = await prisma.userMembership.findMany({
    where: {
      userId,
      status: 'active',
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    include: { plan: true },
    orderBy: { activatedAt: 'desc' },
    take: 3,
  });

  const body = memberships.length
    ? memberships.map((item) => {
        const washRemaining = Math.max(item.plan.washLimit - item.washUsed, 0);
        const grapheneRemaining = Math.max(item.plan.grapheneLimit - item.grapheneUsed, 0);
        return textBox(`${item.plan.name}: Wash ${washRemaining}/${item.plan.washLimit}, Graphene ${grapheneRemaining}/${item.plan.grapheneLimit}`, 'xs', 'regular', '#FFFFFF');
      })
    : [textBox('ยังไม่มีแพ็กเกจ active กดดูโปรโมชันหรือซื้อแพ็กเกจในแอปได้เลย', 'sm', 'regular', '#A3A3A3')];

  return {
    type: 'flex' as const,
    altText: `ROBOSS Active Member: ${memberships.length}`,
    contents: baseBubble({
      title: memberships.length ? 'Active Member' : 'ยังไม่มีแพ็กเกจ',
      subtitle: memberships.length ? 'สิทธิ์ที่ใช้งานได้ตอนนี้' : 'แพ็กเกจจะ active หลังซื้อสำเร็จ',
      body,
      footer: [
        actionButton('เปิดหน้า Member', `${getLineCustomerPortalUrl()}/member`),
        actionButton('ดูโปรโมชั่น', `${getLineCustomerPortalUrl()}/promotion`, 'secondary'),
      ],
    }),
  };
}

function welcomeFlex(displayName: string) {
  const portal = getLineCustomerPortalUrl();
  return {
    type: 'flex' as const,
    altText: 'Welcome to ROBOSS',
    contents: baseBubble({
      title: `สวัสดี ${displayName}`,
      subtitle: 'ลงทะเบียน LINE OA พื้นฐานแล้ว สามารถเช็คพ้อย คูปอง แสตมป์ และสมาชิกผ่าน Rich Menu ได้ทันที',
      body: [
        textBox('ถ้าต้องการใช้คูปอง/ซื้อแพ็กเกจ/ดูประวัติล้าง ให้เข้าสู่ระบบใน Member App ด้วย LINE อีกครั้ง'),
      ],
      footer: [
        actionButton('เปิด Member App', `${portal}/member`),
        actionButton('ดูเมนูสมาชิก', `${portal}/coupon`, 'secondary'),
      ],
    }),
  };
}

function resolveAction(event: any) {
  const data = event?.postback?.data;
  if (typeof data === 'string') {
    const params = new URLSearchParams(data);
    return params.get('action') || data;
  }

  const text = String(event?.message?.text ?? '').trim().toLowerCase();
  if (!text) return 'menu';
  if (['points', 'point', 'พ้อย', 'แต้ม', 'คะแนน'].some((item) => text.includes(item))) return 'points';
  if (['coupon', 'คูปอง'].some((item) => text.includes(item))) return 'coupons';
  if (['stamp', 'แสตมป์', 'สแตมป์'].some((item) => text.includes(item))) return 'stamps';
  if (['member', 'membership', 'สมาชิก', 'แพ็กเกจ', 'package'].some((item) => text.includes(item))) return 'member';
  if (['register', 'ลงทะเบียน', 'สมัคร'].some((item) => text.includes(item))) return 'register';
  return 'menu';
}

export async function buildLineOaReply(event: any): Promise<LineMessage[]> {
  const lineUserId = event?.source?.userId;
  if (!lineUserId) return [menuFlex()];

  const profile = await getLineProfile(lineUserId);
  const user = await ensureLineOaCustomer(lineUserId, profile);

  if (event?.type === 'follow') {
    return [welcomeFlex(user.displayName)];
  }

  const action = resolveAction(event);
  switch (action) {
    case 'points':
      return [await buildPointsFlex(user.id)];
    case 'coupons':
    case 'coupon':
      return [await buildCouponsFlex(user.id)];
    case 'stamps':
    case 'stamp':
      return [await buildStampsFlex(user.id)];
    case 'member':
    case 'membership':
      return [await buildMembershipFlex(user.id)];
    case 'register':
      return [welcomeFlex(user.displayName)];
    default:
      return [menuFlex()];
  }
}
