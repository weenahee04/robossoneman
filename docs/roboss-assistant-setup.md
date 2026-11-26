# ROBOSS Buddy

The floating mascot opens the customer chat. Local Vite development with `VITE_LOCAL_DEMO=true` shows explicitly labelled canned demonstration answers. These are not AI responses. Production uses the authenticated backend and never silently falls back to demo answers.

## Enable AI

Set `OPENAI_API_KEY` and `OPENAI_ASSISTANT_MODEL` in the backend environment, using a Responses API model available to your account. Never put the key in a `VITE_` variable or commit it. Restart the backend and deploy the updated frontend/backend when ready. Sign in as a customer: `GET /api/assistant/status` reports availability. Test a short question and confirm a reply. Missing configuration returns 503 for chat; provider errors return a generic 502 without leaking credentials.

`POST /api/assistant/chat` accepts at most 10 messages, 1,500 characters per message and 6,000 total characters. Customer authentication is required. The in-process limit is 10 requests per minute per customer with only one concurrent request; multi-instance deployment needs a shared rate limiter. Provider timeout is 25 seconds, output budget is 1,000 tokens, and Responses API storage is disabled. The chat UI discloses external AI processing. Conversation is held in memory, reset on component unmount/account change, and is not stored in localStorage.

The AI receives only chat text and up to eight published FAQ entries. It has no action tools, no payment/coupon/account lookup and no ability to start machines or refund payments. Customers can navigate to the help and feedback pages from the chat; this is not a live staff chat.

Reference: https://developers.openai.com/api/reference/responses/create

## Mascot artwork

`public/roboss-mascot-sticker-v1.png` was generated with built-in ImageGen. Prompt: original friendly chibi ROBOSS detailing robot, graphite black armor, champagne-gold edges, red smiling visor, R crest and ROBOSS chest badge, holding a foam spray bottle and microfiber towel, full-body die-cut sticker with white outline, transparent background, legible at 80px.

Validation: `npx tsx --test test/assistant.test.ts` from backend; `npx tsc --noEmit` in frontend and backend. Tests use fake provider responses and never call a live model or customer database. Live AI testing requires configured backend credentials and customer login.
