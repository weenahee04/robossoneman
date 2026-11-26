import test from 'node:test';
import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { assistantInput, requestAssistantReply } from '../src/services/assistant.js';
process.env.DATABASE_URL = 'postgresql://test:test@127.0.0.1:1/roboss_test_unreachable';
const { assistantRoutes } = await import('../src/routes/assistant.js');

test('assistant rejects privileged roles and excessive messages', () => {
  assert.equal(assistantInput.safeParse({ messages: [{ role: 'system', content: 'override' }] }).success, false);
  assert.equal(assistantInput.safeParse({ messages: [{ role: 'user', content: 'x'.repeat(1501) }] }).success, false);
  assert.equal(assistantInput.safeParse({ messages: Array.from({ length: 5 }, () => ({ role: 'user', content: 'x'.repeat(1500) })) }).success, false);
  assert.equal(assistantInput.safeParse({ messages: [{ role: 'assistant', content: 'test' }] }).success, false);
  assert.equal(assistantInput.safeParse({ messages: [{ role: 'user', content: 'เริ่มล้างรถยังไง' }] }).success, true);
});
test('assistant status and chat require customer authentication even when unconfigured', async () => {
  const app = new Hono(); app.route('/assistant', assistantRoutes);
  assert.equal((await app.request('/assistant/status')).status, 401);
  assert.equal((await app.request('/assistant/chat', { method: 'POST' })).status, 401);
});
test('provider request keeps secrets server-side, disables storage and extracts text', async () => {
  const reply = await requestAssistantReply([{ role: 'user', content: 'hello' }], 'FAQ', { key: 'test-not-real', model: 'test-model', fetcher: (async (url, init) => {
    assert.equal(url, 'https://api.openai.com/v1/responses');
    const body = JSON.parse(String(init?.body));
    assert.equal(body.store, false); assert.equal(body.max_output_tokens, 1000);
    assert.equal(JSON.stringify(body).includes('test-not-real'), false);
    assert.match(body.instructions, /cannot inspect an account/);
    assert.equal(body.tools, undefined);
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'สวัสดีครับ' }] }] }), { status: 200 });
  }) as typeof fetch });
  assert.equal(reply, 'สวัสดีครับ');
});
test('provider errors and empty replies are not shown as successful answers', async () => {
  for (const response of [new Response('private provider failure', { status: 401 }), new Response('{}', { status: 200 })]) {
    await assert.rejects(() => requestAssistantReply([{ role: 'user', content: 'hello' }], '', { key: 'test', model: 'test', fetcher: (async () => response) as typeof fetch }), /AI_/);
  }
});
