import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { getIconUrl, type IconName } from '../services/icons';

const ICONS8_BASE = 'https://img.icons8.com/?format=png&size=';

function Ico({ id, size = 20, className = '' }: { id: string | number; size?: number; className?: string }) {
  return <img src={`${ICONS8_BASE}${size * 2}&id=${id}`} width={size} height={size} alt="" className={`inline-block flex-shrink-0 ${className}`} style={{ filter: 'invert(1) brightness(1.1)' }} loading="lazy" />;
}

function I8Icon({ name, size = 20, className = '' }: { name: IconName; size?: number; className?: string }) {
  return <img src={getIconUrl(name, size * 2)} alt={name} width={size} height={size} className={`inline-block ${className}`} style={{ filter: 'invert(1) brightness(1.1)' }} />;
}

interface SettingItem {
  iconId: number;
  label: string;
  description?: string;
  type: 'toggle' | 'link' | 'danger';
  key: string;
  value?: string;
}

const settingSections: { title: string; items: SettingItem[] }[] = [
  {
    title: 'การแจ้งเตือน',
    items: [
      { iconId: 2580, label: 'แจ้งเตือนทั่วไป', description: 'โปรโมชั่น ข่าวสาร', type: 'toggle', key: 'notify_general' },
      { iconId: 25107, label: 'สถานะล้างรถ', description: 'แจ้งเตือนเมื่อล้างเสร็จ', type: 'toggle', key: 'notify_wash' },
      { iconId: 12394, label: 'คูปองใหม่', description: 'แจ้งเตือนคูปองส่วนลด', type: 'toggle', key: 'notify_coupon' },
      { iconId: 6703, label: 'คะแนนสะสม', description: 'เมื่อได้รับหรือใกล้หมดอายุ', type: 'toggle', key: 'notify_points' },
    ],
  },
  {
    title: 'ทั่วไป',
    items: [
      { iconId: 484, label: 'ภาษา', value: 'ไทย', type: 'link', key: 'language' },
      { iconId: 1358, label: 'ข้อมูลส่วนตัว', type: 'link', key: 'profile' },
      { iconId: 2864, label: 'ความเป็นส่วนตัว', type: 'link', key: 'privacy' },
    ],
  },
  {
    title: 'เกี่ยวกับ',
    items: [
      { iconId: 1168, label: 'เวอร์ชันแอป', value: 'v1.0.0', type: 'link', key: 'version' },
      { iconId: 1804, label: 'ข้อกำหนดการใช้งาน', type: 'link', key: 'terms' },
      { iconId: 646, label: 'ช่วยเหลือ', type: 'link', key: 'help' },
    ],
  },
  {
    title: 'บัญชี',
    items: [
      { iconId: 1571, label: 'ออกจากระบบ', type: 'danger', key: 'logout' },
      { iconId: 6861, label: 'ลบบัญชี', description: 'ลบข้อมูลและบัญชีถาวร', type: 'danger', key: 'delete' },
    ],
  },
];

export function SettingsPage({ onBack }: { onBack: () => void }) {
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    notify_general: true,
    notify_wash: true,
    notify_coupon: true,
    notify_points: false,
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleToggle = (key: string) => {
    setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const enabledCount = Object.values(toggles).filter(Boolean).length;

  const containerVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.04 } } };
  const itemVariants = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } } };

  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-app-black/95 flex-shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="text-white -ml-2">
          <I8Icon name="back" size={20} />
        </Button>
        <h1 className="text-white font-bold text-base">ตั้งค่า</h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar">
        <motion.div variants={containerVariants} initial="hidden" animate="show" className="px-4 pt-4 pb-6 space-y-4">

          {settingSections.map((section, sIdx) => (
            <motion.div key={sIdx} variants={itemVariants} className="space-y-2">
              {/* Section header */}
              <div className="flex items-center justify-between px-1">
                <p className="text-white/30 text-[11px] font-medium tracking-wider uppercase">{section.title}</p>
                {section.title === 'การแจ้งเตือน' && (
                  <Badge variant="outline" className="text-[9px] border-app-red/20 text-app-red">{enabledCount}/4 เปิด</Badge>
                )}
              </div>

              {/* Section card */}
              <Card className="p-0 overflow-hidden border-white/5">
                {section.items.map((item, iIdx) => (
                  <div key={item.key}>
                    {iIdx > 0 && <div className="mx-3 h-[1px] bg-white/[0.04]" />}
                    <button
                      onClick={() => {
                        if (item.type === 'toggle') handleToggle(item.key);
                        if (item.key === 'delete') setShowDeleteDialog(true);
                      }}
                      className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-white/[0.02] transition-colors"
                    >
                      {/* Icon */}
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        item.type === 'danger'
                          ? 'bg-app-red/10 border border-app-red/15'
                          : item.type === 'toggle' && toggles[item.key]
                            ? 'bg-app-red/10 border border-app-red/15'
                            : 'bg-black border border-white/10'
                      }`}>
                        <Ico id={item.iconId} size={15} className={item.type === 'danger' ? 'opacity-80' : ''} />
                      </div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-medium ${item.type === 'danger' ? 'text-red-400' : 'text-white'}`}>{item.label}</p>
                        {item.description && (
                          <p className="text-[10px] text-white/20 mt-0.5">{item.description}</p>
                        )}
                      </div>

                      {/* Right side */}
                      {item.type === 'toggle' && (
                        <Switch
                          checked={toggles[item.key] ?? false}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={() => handleToggle(item.key)}
                        />
                      )}
                      {item.type === 'link' && (
                        <div className="flex items-center gap-1.5">
                          {item.value && (
                            <span className="text-white/25 text-[11px]">{item.value}</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/15 flex-shrink-0">
                            <path d="m9 18 6-6-6-6"/>
                          </svg>
                        </div>
                      )}
                      {item.type === 'danger' && item.key !== 'delete' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400/30 flex-shrink-0">
                          <path d="m9 18 6-6-6-6"/>
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </Card>
            </motion.div>
          ))}

          {/* App info footer */}
          <motion.div variants={itemVariants} className="text-center pt-2 pb-4">
            <p className="text-white/10 text-[10px]">ROBOSS Mini App</p>
            <p className="text-white/[0.06] text-[9px] mt-0.5">© 2024 ROBOSS. All rights reserved.</p>
          </motion.div>

        </motion.div>
      </div>

      {/* Delete Account Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-[90%] rounded-2xl bg-[#1a1a1a] border-white/10">
          <DialogHeader>
            <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-2">
              <Ico id={6861} size={22} />
            </div>
            <DialogTitle className="text-red-400 text-center">ลบบัญชี</DialogTitle>
            <DialogDescription className="text-center text-white/40 text-[13px]">
              การลบบัญชีจะไม่สามารถย้อนกลับได้ ข้อมูลทั้งหมดรวมถึงคะแนนสะสมจะถูกลบถาวร
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 mt-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 border-white/10 text-white">ยกเลิก</Button>
            </DialogClose>
            <Button className="flex-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => setShowDeleteDialog(false)}>ลบบัญชี</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
