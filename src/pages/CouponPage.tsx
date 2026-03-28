import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Ticket,
  CheckCircle2,
  Clock,
  AlertCircle } from
'lucide-react';
type TabType = 'all' | 'available' | 'used' | 'expired';
interface Coupon {
  id: string;
  title: string;
  description: string;
  discount: string;
  discountType: 'percent' | 'amount' | 'text';
  minSpend: number;
  expiryDate: string;
  status: 'available' | 'used' | 'expired';
  code: string;
}
const couponsData: Coupon[] = [
{
  id: 'c1',
  title: 'ส่วนลดสมาชิกใหม่',
  description: 'ลด 50% สำหรับการล้างรถครั้งแรก',
  discount: '50',
  discountType: 'percent',
  minSpend: 200,
  expiryDate: '30 เม.ย. 2026',
  status: 'available',
  code: 'NEW50'
},
{
  id: 'c2',
  title: 'ส่วนลด QUICK & CLEAN',
  description: 'ลด 30 บาท เมื่อเลือกแพ็กเกจ QUICK & CLEAN',
  discount: '30',
  discountType: 'amount',
  minSpend: 0,
  expiryDate: '15 พ.ค. 2026',
  status: 'available',
  code: 'QUICK30'
},
{
  id: 'c3',
  title: 'ฟรี ดูดฝุ่นภายใน',
  description: 'รับบริการดูดฝุ่นฟรี เมื่อมียอดใช้จ่ายขั้นต่ำ',
  discount: 'ฟรี',
  discountType: 'text',
  minSpend: 150,
  expiryDate: '1 มิ.ย. 2026',
  status: 'available',
  code: 'FREEVAC'
},
{
  id: 'c4',
  title: 'ส่วนลด SPECIAL MODE',
  description: 'ลด 20% เมื่อเลือกแพ็กเกจ SPECIAL MODE',
  discount: '20',
  discountType: 'percent',
  minSpend: 300,
  expiryDate: '15 เม.ย. 2026',
  status: 'expired',
  code: 'SPEC20'
},
{
  id: 'c5',
  title: 'ส่วนลดพิเศษ',
  description: 'ลด 100 บาท สำหรับบริการใดก็ได้',
  discount: '100',
  discountType: 'amount',
  minSpend: 500,
  expiryDate: '31 ธ.ค. 2026',
  status: 'used',
  code: 'SUPER100'
}];

const tabs: {
  id: TabType;
  label: string;
}[] = [
{
  id: 'all',
  label: 'ทั้งหมด'
},
{
  id: 'available',
  label: 'ใช้ได้'
},
{
  id: 'used',
  label: 'ใช้แล้ว'
},
{
  id: 'expired',
  label: 'หมดอายุ'
}];

interface CouponPageProps {
  onBack: () => void;
}
export function CouponPage({ onBack }: CouponPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('available');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const filteredCoupons = couponsData.filter((coupon) => {
    if (activeTab === 'all') return true;
    return coupon.status === activeTab;
  });
  const handleCopyCode = (code: string) => {
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };
  const renderHeader = () =>
  <div className="flex items-center justify-between px-4 py-4 border-b border-app-dark bg-app-black/95 sticky top-0 z-50">
      <button
      onClick={onBack}
      className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors">
      
        <ChevronLeft size={24} />
      </button>
      <h1 className="text-white font-bold text-lg">คูปองส่วนลด</h1>
      <div className="w-10" /> {/* Spacer for centering */}
    </div>;

  const renderDiscountValue = (coupon: Coupon) => {
    if (coupon.discountType === 'percent') {
      return (
        <div className="flex items-baseline text-white">
          <span className="text-3xl font-black tracking-tighter">
            {coupon.discount}
          </span>
          <span className="text-lg font-bold ml-1">%</span>
        </div>);

    } else if (coupon.discountType === 'amount') {
      return (
        <div className="flex flex-col items-center text-white leading-none">
          <span className="text-3xl font-black tracking-tighter">
            {coupon.discount}
          </span>
          <span className="text-xs font-medium mt-1">บาท</span>
        </div>);

    } else {
      return (
        <div className="text-white">
          <span className="text-2xl font-black tracking-tighter">
            {coupon.discount}
          </span>
        </div>);

    }
  };
  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden relative">
      {renderHeader()}

      {/* Tabs */}
      <div className="px-4 pt-4 pb-2 bg-app-black sticky top-[65px] z-40">
        <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-2">
          {tabs.map((tab) =>
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-app-red text-white' : 'bg-app-dark text-gray-400 hover:text-white'}`}>
            
              {tab.label}
            </button>
          )}
        </div>
      </div>

      {/* Coupon List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredCoupons.length > 0 ?
          filteredCoupons.map((coupon, index) => {
            const isAvailable = coupon.status === 'available';
            const isUsed = coupon.status === 'used';
            const isExpired = coupon.status === 'expired';
            return (
              <motion.div
                key={coupon.id}
                layout
                initial={{
                  opacity: 0,
                  y: 20,
                  scale: 0.95
                }}
                animate={{
                  opacity: 1,
                  y: 0,
                  scale: 1
                }}
                exit={{
                  opacity: 0,
                  scale: 0.95,
                  transition: {
                    duration: 0.2
                  }
                }}
                transition={{
                  duration: 0.3,
                  delay: index * 0.05
                }}
                className={`relative flex rounded-2xl overflow-hidden ${isAvailable ? 'bg-app-dark border border-app-red/20 shadow-[0_4px_20px_rgba(220,38,38,0.05)]' : 'bg-[#111] border border-white/5 opacity-70'}`}>
                
                  {/* Left Side - Discount Amount */}
                  <div
                  className={`w-28 flex flex-col items-center justify-center p-4 relative ${isAvailable ? 'bg-gradient-to-br from-app-red-dark to-app-red' : 'bg-[#1a1a1a]'}`}>
                  
                    {renderDiscountValue(coupon)}
                    {coupon.discountType !== 'text' &&
                  <span className="text-[10px] text-white/80 mt-1 font-medium">
                        ส่วนลด
                      </span>
                  }

                    {/* Left Cutouts */}
                    <div className="absolute -top-3 -right-3 w-6 h-6 bg-app-black rounded-full" />
                    <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-app-black rounded-full" />
                  </div>

                  {/* Dashed Divider */}
                  <div className="w-0 border-r-2 border-dashed border-app-black relative z-10" />

                  {/* Right Side - Details */}
                  <div className="flex-1 p-4 flex flex-col justify-between relative">
                    {/* Right Cutouts */}
                    <div className="absolute -top-3 -left-3 w-6 h-6 bg-app-black rounded-full" />
                    <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-app-black rounded-full" />

                    <div>
                      <div className="flex justify-between items-start mb-1">
                        <h3
                        className={`font-bold text-sm ${isAvailable ? 'text-white' : 'text-gray-400'}`}>
                        
                          {coupon.title}
                        </h3>
                        {isUsed &&
                      <span className="text-[10px] font-bold text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={10} /> ใช้แล้ว
                          </span>
                      }
                        {isExpired &&
                      <span className="text-[10px] font-bold text-red-500/70 bg-red-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <AlertCircle size={10} /> หมดอายุ
                          </span>
                      }
                      </div>
                      <p className="text-[11px] text-gray-400 leading-snug mb-2">
                        {coupon.description}
                      </p>

                      <div className="flex items-center gap-3 text-[10px] text-gray-500">
                        {coupon.minSpend > 0 ?
                      <span>ขั้นต่ำ {coupon.minSpend}฿</span> :

                      <span>ไม่มีขั้นต่ำ</span>
                      }
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {coupon.expiryDate}
                        </span>
                      </div>
                    </div>

                    {isAvailable &&
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                        <div className="text-[10px] font-mono text-gray-400 bg-black/50 px-2 py-1 rounded border border-white/10">
                          {coupon.code}
                        </div>
                        <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className={`text-xs font-bold px-4 py-1.5 rounded-full transition-all ${copiedCode === coupon.code ? 'bg-green-500/20 text-green-500' : 'bg-app-red hover:bg-red-500 text-white shadow-lg shadow-red-900/20'}`}>
                      
                          {copiedCode === coupon.code ?
                      'คัดลอกแล้ว' :
                      'ใช้คูปอง'}
                        </button>
                      </div>
                  }
                  </div>
                </motion.div>);

          }) :

          <motion.div
            initial={{
              opacity: 0,
              y: 20
            }}
            animate={{
              opacity: 1,
              y: 0
            }}
            className="flex flex-col items-center justify-center py-20 text-center">
            
              <div className="w-20 h-20 bg-app-dark rounded-full flex items-center justify-center mb-4 border border-white/5">
                <Ticket size={32} className="text-gray-600" />
              </div>
              <h3 className="text-white font-bold mb-2">
                ไม่มีคูปองในหมวดหมู่นี้
              </h3>
              <p className="text-sm text-gray-500">
                คุณยังไม่มีคูปองส่วนลดที่ตรงกับเงื่อนไขที่คุณเลือก
              </p>
            </motion.div>
          }
        </AnimatePresence>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {copiedCode &&
        <motion.div
          initial={{
            opacity: 0,
            y: 50,
            scale: 0.9
          }}
          animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }}
          exit={{
            opacity: 0,
            y: 20,
            scale: 0.9
          }}
          className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-green-500 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg shadow-green-900/50 flex items-center gap-2 z-50 whitespace-nowrap">
          
            <CheckCircle2 size={16} />
            คัดลอกโค้ด {copiedCode} แล้ว
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}