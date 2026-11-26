import type { ReactNode } from 'react';
import { WashPackageCard } from './WashPackageCard';

const previewProps = {
  name: 'MOTO SHINE 69',
  description: 'ล้างครบขั้นตอน พร้อมเคลือบเงาเพื่อช่วยดูแลผิวสีรถ',
  steps: ['ฉีดน้ำแรงดันสูง', 'โฟมสลายคราบ', 'เป่าแห้ง', 'เคลือบเงา'],
  imageSrc: '/service-cards/wash-shine.webp',
  price: 69,
  durationLabel: 'ประมาณ 1 นาที',
  badge: 'มีเคลือบเงา',
  artworkSrc: '/service-cards/moto-shine-card-v1.png',
  artworkMode: 'text',
  variant: 'shine',
  seriesCode: 'RB-02',
  positionLabel: '2 / 3',
  motorcycle: true,
} as const;

export function WashPackageCardPreview() {
  return (
    <main className="min-h-screen space-y-5 bg-app-black p-4 text-white">
      <h1 className="text-xl font-black">WashPackageCard · 8 states</h1>
      <PreviewRow label="default"><WashPackageCard {...previewProps} /></PreviewRow>
      <PreviewRow label="hover"><WashPackageCard {...previewProps} previewState="hover" /></PreviewRow>
      <PreviewRow label="focus"><WashPackageCard {...previewProps} previewState="focus" /></PreviewRow>
      <PreviewRow label="active"><WashPackageCard {...previewProps} previewState="active" /></PreviewRow>
      <PreviewRow label="disabled"><WashPackageCard {...previewProps} disabled /></PreviewRow>
      <PreviewRow label="loading"><WashPackageCard {...previewProps} state="loading" /></PreviewRow>
      <PreviewRow label="error"><WashPackageCard {...previewProps} state="error" /></PreviewRow>
      <PreviewRow label="success"><WashPackageCard {...previewProps} state="success" selected /></PreviewRow>
    </main>
  );
}

function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mx-auto grid max-w-sm gap-2">
      <p className="text-xs font-bold uppercase tracking-widest text-white/45">{label}</p>
      {children}
    </section>
  );
}
