import { WashGoalCard } from './WashGoalCard';

const previewProps = {
  title: 'ล้างมอเตอร์ไซค์ด่วน',
  description: 'ฉีดน้ำแรงดันสูง โฟม และเป่าแห้ง ระบบไร้สัมผัส',
  detail: 'ประมาณ 1–3 นาที · เริ่มต้น 49 บาท',
  badge: 'เร็วที่สุด',
  imageSrc: '/service-cards/wash-express.webp',
} as const;

export function WashGoalCardPreview() {
  return (
    <main className="min-h-screen space-y-4 bg-app-black p-4 text-white">
      <h1 className="text-xl font-black">WashGoalCard · 8 states</h1>
      <WashGoalCard {...previewProps} />
      <WashGoalCard {...previewProps} previewState="hover" />
      <WashGoalCard {...previewProps} previewState="focus" />
      <WashGoalCard {...previewProps} previewState="active" />
      <WashGoalCard {...previewProps} disabled />
      <WashGoalCard {...previewProps} state="loading" />
      <WashGoalCard {...previewProps} state="error" />
      <WashGoalCard {...previewProps} state="success" />
    </main>
  );
}
