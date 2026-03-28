import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, XIcon } from 'lucide-react';
interface PromotionPageProps {
  onBack: () => void;
}
interface Promotion {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  discountBadge: string;
  validUntil: string;
  conditions: string[];
  gradient: string;
  patternOpacity: number;
  image?: string;
}
const promotions: Promotion[] = [
{
  id: 'p0',
  title: 'ล้างรถยนต์อัตโนมัติ\nเริ่มต้น 99 บาท',
  subtitle: 'สะดวก ประหยัด สะอาด รวดเร็ว',
  description:
  'บริการล้างรถยนต์อัตโนมัติ ROBOSS สะดวก ประหยัด สะอาด รวดเร็ว ด้วยระบบล้างรถอัตโนมัติที่ทันสมัย เริ่มต้นเพียง 99 บาท ใช้ได้ทุกสาขา',
  discountBadge: 'เริ่ม 99฿',
  validUntil: '31 ธ.ค. 2024',
  conditions: [
  'ราคาเริ่มต้นสำหรับรถขนาด S',
  'ใช้ได้ทุกสาขาที่ร่วมรายการ',
  'ราคาอาจแตกต่างตามขนาดรถ'],

  gradient: 'from-app-red via-red-600 to-app-red-dark',
  patternOpacity: 0,
  image: "/freepik_assistant_1774454922406.png"

},
{
  id: 'p1',
  title: 'ล้าง 3 ครั้ง\nฟรี 1 ครั้ง!',
  subtitle: 'สำหรับสมาชิก ROBOSS',
  description:
  'สะสมการล้างรถครบ 3 ครั้ง รับสิทธิ์ล้างรถฟรี 1 ครั้งทันที ไม่จำกัดแพ็กเกจ ใช้ได้ทุกสาขาที่ร่วมรายการ',
  discountBadge: 'ฟรี 1 ครั้ง',
  validUntil: '30 มิ.ย. 2024',
  conditions: [
  'เฉพาะสมาชิก ROBOSS',
  'สะสมครบ 3 ครั้งภายใน 30 วัน',
  'ใช้ได้ทุกสาขา',
  'ไม่สามารถใช้ร่วมกับโปรโมชั่นอื่นได้'],

  gradient: 'from-app-red via-red-600 to-app-red-dark',
  patternOpacity: 0.1
},
{
  id: 'p2',
  title: 'SHINE MODE\nลด 20%',
  subtitle: 'แพ็กเกจเคลือบเงาพิเศษ',
  description:
  'ล้างรถพร้อมเคลือบเงาพิเศษ ในราคาที่คุ้มกว่าเดิม ด้วยแพ็กเกจ SHINE MODE ที่ให้ความเงางามยาวนาน',
  discountBadge: '-20%',
  validUntil: '15 พ.ค. 2024',
  conditions: ['ไม่มีขั้นต่ำ', 'ใช้ได้ทุกขนาดรถ', 'ใช้ได้ 1 ครั้ง/บัญชี'],
  gradient: 'from-blue-600 via-blue-700 to-indigo-800',
  patternOpacity: 0.08
},
{
  id: 'p3',
  title: 'เคลือบแก้ว\n999 บาท',
  subtitle: 'ปกติ 1,500 บาท',
  description:
  'ปกป้องสีรถของคุณด้วยน้ำยาเคลือบแก้วคุณภาพสูง ทนทานนานถึง 6 เดือน ช่วยให้รถเงางามและป้องกันรอยขีดข่วน',
  discountBadge: '999฿',
  validUntil: '31 พ.ค. 2024',
  conditions: [
  'เฉพาะรถขนาด S และ M',
  'รถขนาด L เพิ่ม 300 บาท',
  'รับประกันความเงา 6 เดือน'],

  gradient: 'from-amber-500 via-amber-600 to-orange-700',
  patternOpacity: 0.12
},
{
  id: 'p4',
  title: 'สมาชิกใหม่\nลด 50%',
  subtitle: 'ต้อนรับสมาชิกใหม่',
  description:
  'สมัครสมาชิก ROBOSS วันนี้ รับส่วนลดทันที 50% สำหรับการล้างรถครั้งแรก ใช้ได้กับทุกแพ็กเกจ',
  discountBadge: '-50%',
  validUntil: '31 ธ.ค. 2024',
  conditions: [
  'เฉพาะสมาชิกใหม่',
  'ใช้ได้ครั้งแรกเท่านั้น',
  'ใช้ได้กับทุกแพ็กเกจ'],

  gradient: 'from-purple-600 via-purple-700 to-violet-800',
  patternOpacity: 0.1
},
{
  id: 'p5',
  title: 'QUICK & CLEAN\nเพียง 79฿',
  subtitle: 'ล้างด่วน สะอาดไว',
  description:
  'แพ็กเกจล้างรถด่วน QUICK & CLEAN ในราคาพิเศษเพียง 79 บาท จากปกติ 99 บาท สะอาดไวใน 15 นาที',
  discountBadge: '79฿',
  validUntil: '30 เม.ย. 2024',
  conditions: [
  'เฉพาะวันจันทร์ - ศุกร์',
  'เฉพาะรถขนาด S',
  'ใช้ได้ไม่จำกัดจำนวนครั้ง'],

  gradient: 'from-cyan-600 via-teal-600 to-emerald-700',
  patternOpacity: 0.08
},
{
  id: 'p6',
  title: 'ดูดฝุ่นฟรี\nเมื่อล้างครบ 500฿',
  subtitle: 'บริการเสริมฟรี',
  description:
  'รับบริการดูดฝุ่นภายในรถฟรี เมื่อใช้บริการล้างรถครบ 500 บาทขึ้นไป ทำความสะอาดครบจบในที่เดียว',
  discountBadge: 'ฟรี',
  validUntil: '30 มิ.ย. 2024',
  conditions: [
  'ยอดรวม 500 บาทขึ้นไปต่อครั้ง',
  'ใช้ได้ทุกสาขา',
  'ไม่สามารถสะสมยอดข้ามครั้งได้'],

  gradient: 'from-green-600 via-green-700 to-emerald-800',
  patternOpacity: 0.1
}];

export function PromotionPage({ onBack }: PromotionPageProps) {
  const [selectedPromo, setSelectedPromo] = useState<Promotion | null>(null);
  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden relative">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-app-dark bg-app-black/95 sticky top-0 z-50">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors">
          
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-white font-bold text-lg">โปรโมชั่น</h1>
        <div className="w-10" />
      </div>

      {/* Banner List */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5 space-y-4 pb-10">
        {promotions.map((promo, index) =>
        <motion.button
          key={promo.id}
          initial={{
            opacity: 0,
            y: 30
          }}
          animate={{
            opacity: 1,
            y: 0
          }}
          transition={{
            delay: index * 0.07,
            duration: 0.4,
            type: 'spring',
            stiffness: 250,
            damping: 22
          }}
          onClick={() => setSelectedPromo(promo)}
          className="w-full relative rounded-2xl overflow-hidden shadow-lg text-left active:scale-[0.98] transition-transform">
          
            {promo.image ?
          <>
                <img
              src={promo.image}
              alt={promo.title}
              className="w-full h-auto object-cover"
              draggable={false} />
            
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3 flex justify-end">
                  <span className="text-white/90 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/20">
                    ดูรายละเอียด
                  </span>
                </div>
              </> :

          <>
                {/* Gradient Background */}
                <div
              className={`absolute inset-0 bg-gradient-to-br ${promo.gradient}`}>
            </div>

                {/* Dot Pattern */}
                <div
              className="absolute inset-0"
              style={{
                opacity: promo.patternOpacity,
                backgroundImage:
                'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                backgroundSize: '16px 16px'
              }}>
            </div>

                {/* Decorative Circle */}
                <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-md"></div>
                <div className="absolute -right-4 bottom-0 w-24 h-24 bg-black/10 rounded-full blur-lg"></div>

                {/* Content */}
                <div className="relative z-10 p-5 min-h-[140px] flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="text-white/80 text-[11px] font-medium mb-1.5">
                        {promo.subtitle}
                      </p>
                      <h3 className="text-2xl font-black text-white leading-tight whitespace-pre-line">
                        {promo.title}
                      </h3>
                    </div>
                    <span className="bg-white text-gray-900 text-xs font-black px-3 py-1.5 rounded-full shadow-lg shrink-0 ml-3">
                      {promo.discountBadge}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-4">
                    <p className="text-white/70 text-[11px]">
                      ถึง {promo.validUntil}
                    </p>
                    <span className="text-white/90 text-xs font-bold bg-white/20 px-3 py-1.5 rounded-lg backdrop-blur-sm border border-white/20">
                      ดูรายละเอียด
                    </span>
                  </div>
                </div>
              </>
          }
          </motion.button>
        )}
      </div>

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedPromo &&
        <motion.div
          initial={{
            opacity: 0
          }}
          animate={{
            opacity: 1
          }}
          exit={{
            opacity: 0
          }}
          transition={{
            duration: 0.2
          }}
          className="absolute inset-0 z-[60] bg-black/70 backdrop-blur-sm"
          onClick={() => setSelectedPromo(null)}>
          
            <motion.div
            initial={{
              y: '100%'
            }}
            animate={{
              y: 0
            }}
            exit={{
              y: '100%'
            }}
            transition={{
              type: 'spring',
              stiffness: 300,
              damping: 30
            }}
            className="absolute bottom-0 left-0 right-0 bg-app-black rounded-t-3xl border-t border-white/10 max-h-[85%] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            
              {/* Drag Handle */}
              <div className="w-full flex justify-center pt-3 pb-1">
                <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
              </div>

              {/* Modal Header Banner */}
              <div className={`mx-4 mt-2 rounded-2xl overflow-hidden relative`}>
                {selectedPromo.image ?
              <img
                src={selectedPromo.image}
                alt={selectedPromo.title}
                className="w-full h-auto object-cover" /> :


              <>
                    <div
                  className={`absolute inset-0 bg-gradient-to-br ${selectedPromo.gradient}`}>
                </div>
                    <div
                  className="absolute inset-0"
                  style={{
                    opacity: selectedPromo.patternOpacity,
                    backgroundImage:
                    'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                    backgroundSize: '16px 16px'
                  }}>
                </div>
                    <div className="absolute -right-8 -top-8 w-36 h-36 bg-white/10 rounded-full blur-md"></div>
                    <div className="relative z-10 p-5">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-white/80 text-[11px] font-medium mb-1">
                            {selectedPromo.subtitle}
                          </p>
                          <h3 className="text-2xl font-black text-white leading-tight whitespace-pre-line">
                            {selectedPromo.title}
                          </h3>
                        </div>
                      </div>
                    </div>
                  </>
              }
                <button
                onClick={() => setSelectedPromo(null)}
                className="absolute top-3 right-3 z-20 w-8 h-8 bg-black/30 rounded-full flex items-center justify-center text-white/80 hover:bg-black/50 transition-colors backdrop-blur-sm">
                
                  <XIcon size={16} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-5 space-y-5">
                {/* Discount Badge */}
                <div className="flex items-center gap-3">
                  <span
                  className={`bg-gradient-to-br ${selectedPromo.gradient} text-white text-lg font-black px-4 py-2 rounded-xl shadow-lg`}>
                  
                    {selectedPromo.discountBadge}
                  </span>
                  <div>
                    <p className="text-white font-bold text-sm">ส่วนลดพิเศษ</p>
                    <p className="text-gray-400 text-xs">
                      ถึง {selectedPromo.validUntil}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-app-dark rounded-xl p-4 border border-white/5">
                  <h4 className="text-white font-bold text-sm mb-2">
                    รายละเอียด
                  </h4>
                  <p className="text-gray-300 text-sm leading-relaxed">
                    {selectedPromo.description}
                  </p>
                </div>

                {/* Conditions */}
                <div className="bg-app-dark rounded-xl p-4 border border-white/5">
                  <h4 className="text-white font-bold text-sm mb-3">
                    เงื่อนไขการใช้งาน
                  </h4>
                  <div className="space-y-2.5">
                    {selectedPromo.conditions.map((condition, idx) =>
                  <div key={idx} className="flex items-start gap-2.5">
                        <span className="w-5 h-5 rounded-full bg-white/10 text-gray-300 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <p className="text-gray-300 text-sm">{condition}</p>
                      </div>
                  )}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="p-4 border-t border-white/5">
                <button className="w-full bg-app-red hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-900/50 text-base">
                  ใช้โปรโมชั่น
                </button>
              </div>
            </motion.div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}