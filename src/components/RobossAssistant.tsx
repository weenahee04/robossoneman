import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send, X, RotateCcw, MessageCircle } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription, DialogClose } from './ui/dialog';
import { useAuth } from '../contexts/AuthContext';
import { USE_LOCAL_DEV_FALLBACK } from '../lib/runtime';
import api from '../services/api';
import './RobossAssistant.css';

type Message = { role: 'user' | 'assistant'; content: string };
const demo = import.meta.env.DEV && USE_LOCAL_DEV_FALLBACK;
const mascot = '/roboss-mascot-sticker-v1.png';
const welcome: Message = { role: 'assistant', content: 'สวัสดีครับ ผม ROBOSS Buddy 👋\nให้ผมช่วยเรื่องล้างรถ คูปอง หรือวิธีใช้แอปได้เลยครับ' };
const prompts = ['เริ่มล้างรถยังไง?', 'ใช้คูปองยังไง?', 'เครื่องมีปัญหาทำยังไง?'];
const demoReply = 'ไม่มีคีย์ api codex';

export function RobossAssistant() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'checking' | 'ready' | 'unavailable'>(demo ? 'ready' : 'checking');
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    request.current?.abort(); busy.current = false; setPending(false); setOpen(false); setMessages([welcome]); setDraft(''); setError('');
    return () => request.current?.abort();
  }, [user?.id]);
  useEffect(() => {
    if (!open || demo) return;
    let active = true; setStatus('checking');
    api.getAssistantStatus().then(result => { if (active) setStatus(result.available ? 'ready' : 'unavailable'); }).catch(() => { if (active) setStatus('unavailable'); });
    return () => { active = false; };
  }, [open]);
  useEffect(() => { if (log.current) log.current.scrollTop = log.current.scrollHeight; }, [messages, pending, open]);

  async function send(text: string) {
    const content = text.trim();
    if (!content || content.length > 1500 || busy.current || status !== 'ready') return;
    const next: Message[] = [...messages, { role: 'user', content }];
    setMessages(next); setDraft(''); setError('');
    if (demo) { setMessages([...next, { role: 'assistant', content: demoReply }]); return; }
    busy.current = true; setPending(true);
    const controller = new AbortController(); request.current = controller;
    try {
      const history = next.slice(1).slice(-9).map(message => ({ ...message, content: message.content.slice(0, 1500) }));
      while (history.length > 1 && history.reduce((sum, message) => sum + message.content.length, 0) > 6000) history.shift();
      const result = await api.chatWithAssistant(history, controller.signal);
      if (!controller.signal.aborted) setMessages([...next, { role: 'assistant', content: result.reply }]);
    } catch {
      if (!controller.signal.aborted) { setMessages(messages); setDraft(content); setError('ส่งข้อความไม่สำเร็จ ลองส่งอีกครั้ง หรือติดต่อพนักงานครับ'); }
    } finally {
      if (request.current === controller) { busy.current = false; setPending(false); }
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button type="button" className="roboss-buddy-launcher" aria-label="เปิดแชท ROBOSS Buddy ผู้ช่วยล้างรถ">
          <span className="roboss-buddy-launcher__label"><MessageCircle size={12} /> ถามบัดดี้</span>
          <img src={mascot} alt="" width="88" height="88" draggable={false} />
        </button>
      </DialogTrigger>
      <DialogContent className="roboss-buddy-chat">
        <header className="roboss-buddy-header">
          <img src={mascot} alt="มาสคอต ROBOSS Buddy" width="52" height="52" />
          <div><DialogTitle>ROBOSS Buddy</DialogTitle><DialogDescription>{demo ? 'โหมดตัวอย่าง · คำตอบสำเร็จรูป' : 'ผู้ช่วย AI สำหรับการล้างรถ'}</DialogDescription></div>
          <DialogClose asChild><button className="roboss-buddy-icon" type="button" aria-label="ปิดแชท"><X size={20} /></button></DialogClose>
        </header>
        {demo && <p className="roboss-buddy-notice">ลองหน้าตาแชทได้ที่นี่ · ยังไม่ได้เชื่อม AI จริง</p>}
        {!demo && <p className="roboss-buddy-notice">ข้อความที่ส่งจะประมวลผลโดย AI ของ OpenAI กรุณาไม่ส่งรหัสผ่านหรือข้อมูลการชำระเงิน</p>}
        <div className="roboss-buddy-log" ref={log} role="log" aria-live="polite" aria-label="บทสนทนากับ ROBOSS Buddy">
          {messages.map((message, index) => <div key={index} className={`roboss-buddy-message roboss-buddy-message--${message.role}`}><span className="sr-only">{message.role === 'user' ? 'คุณ: ' : 'บัดดี้: '}</span>{message.content}</div>)}
          {pending && <p className="roboss-buddy-wait" role="status">บัดดี้กำลังตอบ…</p>}
        </div>
        {status === 'checking' && <p className="roboss-buddy-notice" role="status">กำลังเชื่อมต่อผู้ช่วย…</p>}
        {status === 'unavailable' && <p className="roboss-buddy-notice" role="status">ผู้ช่วย AI ยังไม่พร้อมใช้งาน ดูวิธีใช้บริการหรือติดต่อพนักงานด้านล่างได้ครับ</p>}
        {messages.length === 1 && status === 'ready' && <div className="roboss-buddy-prompts">{prompts.map(prompt => <button type="button" key={prompt} onClick={() => void send(prompt)}>{prompt}</button>)}</div>}
        {error && <p className="roboss-buddy-error" role="alert">{error}</p>}
        <form className="roboss-buddy-composer" onSubmit={event => { event.preventDefault(); void send(draft); }}>
          <label className="sr-only" htmlFor="buddy-message">ข้อความถึงบัดดี้</label>
          <textarea id="buddy-message" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1500} rows={2} placeholder="พิมพ์ถามบัดดี้…" disabled={pending || status !== 'ready'} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }} />
          <button type="submit" aria-label="ส่งข้อความ" disabled={!draft.trim() || pending || status !== 'ready'}><Send size={19} /></button>
        </form>
        <footer className="roboss-buddy-footer"><Link to="/faq" onClick={() => setOpen(false)}>วิธีใช้บริการ</Link><Link to="/feedback" onClick={() => setOpen(false)}>ติดต่อพนักงาน</Link><button type="button" disabled={pending} onClick={() => { setMessages([welcome]); setDraft(''); setError(''); }} aria-label="เริ่มบทสนทนาใหม่"><RotateCcw size={14} /> เริ่มใหม่</button></footer>
      </DialogContent>
    </Dialog>
  );
}
