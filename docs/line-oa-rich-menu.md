# ROBOSS LINE OA Rich Menu

This integration lets customers use the LINE Official Account rich menu to check ROBOSS points, coupons, stamps, and active memberships. LINE sends webhook events to ROBOSS, and the backend replies with LINE Flex Messages using existing customer data.

## Backend Endpoints

- `GET /api/line/health`
- `POST /api/line/webhook`

Use this webhook URL in LINE Developers:

```text
https://YOUR_BACKEND_DOMAIN/api/line/webhook
```

For local tunnel testing, use the active Cloudflare tunnel domain:

```text
https://YOUR_TUNNEL.trycloudflare.com/api/line/webhook
```

## Required Environment Variables

Add these to `backend/.env` or production backend env:

```env
LINE_MESSAGING_CHANNEL_SECRET="from LINE OA Messaging API channel"
LINE_MESSAGING_CHANNEL_ACCESS_TOKEN="long-lived channel access token"
LINE_CUSTOMER_PORTAL_URL="https://your-customer-webapp-domain"
```

Important: the LINE Login channel and LINE OA Messaging API channel should be in the same LINE Developers Provider. This keeps the LINE user ID aligned with `users.line_user_id`.

## Rich Menu Actions

The rich menu script creates six tap areas:

- `action=points` - replies with points balance and recent point activity
- Coupons rich-menu area - opens `LINE_CUSTOMER_PORTAL_URL/coupon` directly so customers can buy coupons by transfer and upload slips
- `action=stamps` - replies with current stamp progress
- `action=member` - replies with active membership benefits
- `action=register` - creates/updates the LINE OA customer record and sends app link
- Open App - opens `LINE_CUSTOMER_PORTAL_URL/member`

## Create Rich Menu

Prepare a JPG or PNG image:

```text
2500 x 1686 px
```

Then set:

```env
LINE_RICH_MENU_IMAGE_PATH="./assets/roboss-rich-menu.png"
LINE_RICH_MENU_SET_DEFAULT=true
```

Run:

```bash
cd backend
npm run line:rich-menu
```

The script prints `LINE_RICH_MENU_ID=...`. Keep that value in production env if needed.

## Customer Registration Behavior

When a customer follows the OA or taps a rich menu item, ROBOSS uses the LINE OA `source.userId` to create or update a basic customer record:

- `lineUserId`
- `displayName`
- `avatarUrl`
- default settings
- stamp card
- point wallet
- piggy bank

When the customer later logs in through the customer WebApp with LINE/Clerk, the backend updates the same user if the LINE provider user ID matches.

## Production Checklist

- Enable Messaging API in LINE Official Account Manager.
- Set webhook URL to `https://YOUR_BACKEND_DOMAIN/api/line/webhook`.
- Turn on "Use webhook".
- Turn off auto-reply or make sure auto-reply does not conflict with bot replies.
- Add `LINE_MESSAGING_CHANNEL_SECRET`.
- Add `LINE_MESSAGING_CHANNEL_ACCESS_TOKEN`.
- Add `LINE_CUSTOMER_PORTAL_URL`.
- Deploy backend.
- Run `GET /api/line/health`.
- Send test webhook from LINE Developers.
- Create and set rich menu default after uploading the 2500x1686 image.
