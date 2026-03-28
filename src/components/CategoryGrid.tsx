import React from 'react';
const categories = [
{
  label: 'ล้างรถอัตโนมัติ',
  gradient: 'bg-white',
  icon: () =>
  <img
    src="/icon_03_robot_arm.svg"
    alt="ล้างรถอัตโนมัติ"
    className="w-[60px] h-[60px] object-cover" />


},
{
  label: 'เคลือบแก้ว',
  gradient: 'bg-gradient-to-br from-red-500 to-app-red-dark',
  icon: () =>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-8 h-8 text-white drop-shadow-md">
    
        <path
      d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z"
      fill="rgba(255,255,255,0.3)" />
    
        <path d="M5 19l1-2.5L8.5 18" />
        <path d="M19 19l-1-2.5L15.5 18" />
      </svg>

},
{
  label: 'ขัดสี',
  gradient: 'bg-gradient-to-br from-red-500 to-app-red-dark',
  icon: () =>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-8 h-8 text-white drop-shadow-md">
    
        <circle cx="12" cy="12" r="8" fill="rgba(255,255,255,0.15)" />
        <circle cx="12" cy="12" r="4" fill="rgba(255,255,255,0.25)" />
        <path d="M12 4v2M12 18v2M4 12h2M18 12h2" strokeWidth="2.5" />
      </svg>

},
{
  label: 'ดูดฝุ่น ภายใน',
  gradient: 'bg-gradient-to-br from-red-500 to-app-red-dark',
  icon: () =>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-8 h-8 text-white drop-shadow-md">
    
        <rect
      x="4"
      y="4"
      width="8"
      height="16"
      rx="2"
      fill="rgba(255,255,255,0.15)" />
    
        <path d="M12 8h6a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-6" />
        <path d="M8 10v4" strokeWidth="2.5" />
        <circle cx="17" cy="12" r="1.5" fill="white" />
      </svg>

},
{
  label: 'โปรโมชั่น',
  gradient: 'bg-white',
  icon: () =>
  <img
    src="/icon_04_robot_gift.svg"
    alt="โปรโมชั่น"
    className="w-[60px] h-[60px] object-cover" />


},
{
  label: 'คูปองส่วนลด',
  gradient: 'bg-transparent',
  icon: () =>
  <img
    src="/freepik_assistant_1774703023289.png"
    alt="คูปองส่วนลด"
    className="w-[60px] h-[60px] object-cover" />


},
{
  label: 'สาขาใกล้คุณ',
  gradient: 'bg-white',
  icon: () =>
  <img
    src="/icon_01_robot_home.svg"
    alt="สาขาใกล้คุณ"
    className="w-[60px] h-[60px] object-cover" />


},
{
  label: 'บัตรสมาชิก',
  gradient: 'bg-white',
  icon: () =>
  <img
    src="/icon_05_robot_crown.svg"
    alt="บัตรสมาชิก"
    className="w-[60px] h-[60px] object-cover" />


}];

export function CategoryGrid({
  onNavigate,
  onNavigateCoupon,
  onNavigateBranches,
  onNavigateMember,
  onNavigatePromotion






}: {onNavigate?: () => void;onNavigateCoupon?: () => void;onNavigateBranches?: () => void;onNavigateMember?: () => void;onNavigatePromotion?: () => void;}) {
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
                }
              }}
              className="flex flex-col items-center gap-2.5 group">
              
              <div
                className={`w-[60px] h-[60px] rounded-[20px] ${cat.gradient} flex items-center justify-center shadow-lg shadow-black/20 transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-1 relative overflow-hidden border border-white/10`}>
                
                <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent opacity-50"></div>
                <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors duration-300"></div>
                <div className="relative z-10 transform group-hover:scale-110 transition-transform duration-300">
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