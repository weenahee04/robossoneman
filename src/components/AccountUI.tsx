import React from 'react';
import { ArrowLeft, ArrowRight, Bell, CarFront, Check, ChevronDown, ChevronRight, CircleHelp, Clock, CreditCard, Gift, LogOut, Mail, MessageCircle, Pencil, Phone, Plus, Settings, ShieldCheck, Star, Ticket, UserRound } from 'lucide-react';
import '../styles/account.css';

const icons = { back: ArrowLeft, arrow: ArrowRight, bell: Bell, car: CarFront, check: Check, down: ChevronDown, next: ChevronRight, help: CircleHelp, clock: Clock, member: CreditCard, gift: Gift, logout: LogOut, mail: Mail, line: MessageCircle, edit: Pencil, phone: Phone, plus: Plus, settings: Settings, shield: ShieldCheck, star: Star, ticket: Ticket, user: UserRound };
export type AccountIconName = keyof typeof icons;
export function AccountIcon({ name, size = 22 }: { name: AccountIconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={2} aria-hidden="true" className="account-icon" />;
}

export function AccountPage({ title, onBack, action, children }: { title: string; onBack: () => void; action?: React.ReactNode; children: React.ReactNode }) {
  return <div className="account-page">
    <header className="account-header">
      <button type="button" className="account-icon-button" aria-label="ย้อนกลับ" onClick={onBack}><AccountIcon name="back" /></button>
      <h1>{title}</h1><div className="account-header__action">{action}</div>
    </header>
    <div className="account-scroll"><div className="account-content">{children}</div></div>
  </div>;
}

export function AccountSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return <section className="account-section"><div className="account-section__heading"><h2>{title}</h2>{action}</div>{children}</section>;
}

export function AccountEmpty({ icon, title, children }: { icon: AccountIconName; title: string; children?: React.ReactNode }) {
  return <div className="account-empty" role="status"><AccountIcon name={icon} size={28} /><h2>{title}</h2>{children}</div>;
}
