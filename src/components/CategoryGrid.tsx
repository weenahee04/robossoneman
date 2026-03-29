import React from 'react';
const categories = [
{
  label: 'ล้างรถอัตโนมัติ',
  icon: () =>
  <img src="/icon_3_robot_arm.png" alt="ล้างรถอัตโนมัติ" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'เคลือบแก้ว',
  icon: () =>
  <img src="/icon_9_robot_gear.png" alt="เคลือบแก้ว" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'ขัดสี',
  icon: () =>
  <img src="/icon_8_chat_robots.png" alt="ขัดสี" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'ดูดฝุ่น ภายใน',
  icon: () =>
  <img src="/icon_2_calendar.png" alt="ดูดฝุ่น ภายใน" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'โปรโมชั่น',
  icon: () =>
  <img src="/icon_4_gift_robot.png" alt="โปรโมชั่น" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'คูปองส่วนลด',
  icon: () =>
  <img src="/icon_6_bell.png" alt="คูปองส่วนลด" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'สาขาใกล้คุณ',
  icon: () =>
  <img src="/icon_1_home_robot.png" alt="สาขาใกล้คุณ" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'บัตรสมาชิก',
  icon: () =>
  <img src="/icon_5_crown_robot.png" alt="บัตรสมาชิก" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
{
  label: 'บทความ',
  icon: () =>
  <img src="/icon_7_bell2.png" alt="บทความ" className="w-[72px] h-[72px] object-contain rounded-[22%]" />
},
];

export function CategoryGrid({
  onNavigate,
  onNavigateCoupon,
  onNavigateBranches,
  onNavigateMember,
  onNavigatePromotion,
  onNavigateArticle,






}: {onNavigate?: () => void;onNavigateCoupon?: () => void;onNavigateBranches?: () => void;onNavigateMember?: () => void;onNavigatePromotion?: () => void;onNavigateArticle?: () => void;}) {
  return (
    <div className="px-4 py-4">
      <div className="grid grid-cols-4 gap-y-6 gap-x-3">
        {categories.map((cat, index) => {
          const Icon = cat.icon;
          return (
            <button
              key={index}
              onClick={() => {
                if (index === 0 && onNavigate) {
                  onNavigate();
                } else if (index === 4 && onNavigatePromotion) {
                  onNavigatePromotion();
                } else if (index === 5 && onNavigateCoupon) {
                  onNavigateCoupon();
                } else if (index === 6 && onNavigateBranches) {
                  onNavigateBranches();
                } else if (index === 7 && onNavigateMember) {
                  onNavigateMember();
                } else if (index === 8 && onNavigateArticle) {
                  onNavigateArticle();
                }
              }}
              className="flex flex-col items-center gap-2.5 group">
              
              <div className="transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 drop-shadow-lg overflow-hidden rounded-[22%]" style={{ transform: 'translateZ(0)', willChange: 'transform' }}>
                <div className="transform group-hover:scale-110 transition-transform duration-300">
                  <Icon />
                </div>
              </div>
              <span className="text-[11px] text-center text-gray-300 font-medium leading-tight h-8 flex items-start justify-center px-1 group-hover:text-white transition-colors">
                {cat.label}
              </span>
            </button>);

        })}
      </div>
    </div>);

}