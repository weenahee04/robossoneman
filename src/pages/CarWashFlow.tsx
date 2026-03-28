import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  QrCode,
  CreditCard,
  Wallet,
  Smartphone,
  CheckCircle2,
  Loader2,
  Sparkles,
  Droplets,
  Wind,
  Car,
  Crown,
  Clock,
  Star,
  Zap } from
'lucide-react';
type Step = 'scan' | 'payment' | 'working' | 'complete';
type CarSize = 'S' | 'M' | 'L';
interface CarWashFlowProps {
  onBack: () => void;
}
const carSizes: {
  id: CarSize;
  label: string;
  desc: string;
}[] = [
{
  id: 'S',
  label: 'S',
  desc: 'รถเล็ก'
},
{
  id: 'M',
  label: 'M',
  desc: 'รถกลาง'
},
{
  id: 'L',
  label: 'L',
  desc: 'รถใหญ่'
}];

const allCards = [
{
  id: 'quick',
  name: 'QUICK & CLEAN',
  image: "/freepik_0001.png",

  prices: {
    S: 99,
    M: 109,
    L: 129
  },
  isAddon: false
},
{
  id: 'shine',
  name: 'SHINE MODE',
  image: "/freepik_0001_(1).png",

  prices: {
    S: 139,
    M: 149,
    L: 169
  },
  isAddon: false
},
{
  id: 'special',
  name: 'SPECIAL MODE',
  image: "/freepik_0001_(2).png",

  prices: {
    S: 339,
    M: 399,
    L: 469
  },
  isAddon: false
},
{
  id: 'vacuum',
  name: 'ดูดฝุ่นภายใน',
  image: "/freepik_0001_(3).png",

  prices: {
    S: 70,
    M: 90,
    L: 120
  },
  isAddon: true
}];

const paymentMethods = [
{
  id: 'qr',
  name: 'สแกนจ่าย QR',
  icon: QrCode
},
{
  id: 'card',
  name: 'บัตรเครดิต/เดบิต',
  icon: CreditCard
},
{
  id: 'wallet',
  name: 'ROBOSS Wallet',
  icon: Wallet
}];

export function CarWashFlow({ onBack }: CarWashFlowProps) {
  const [currentStep, setCurrentStep] = useState<Step>('scan');
  const [carSize, setCarSize] = useState<CarSize>('M');
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const [addVacuum, setAddVacuum] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(paymentMethods[0].id);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [dragConstraints, setDragConstraints] = useState({
    left: 0,
    right: 0
  });
  const [progress, setProgress] = useState(0);
  const [currentSubStep, setCurrentSubStep] = useState(0);
  const selectedCard = allCards[selectedCardIndex];
  const mainPackage = selectedCard.isAddon ? allCards[0] : selectedCard;
  const totalPrice =
  mainPackage.prices[carSize] + (addVacuum ? allCards[3].prices[carSize] : 0);
  const handleCardSelect = (index: number) => {
    setSelectedCardIndex(index);
    if (allCards[index].isAddon) {
      setAddVacuum(true);
    }
  };
  // Calculate drag constraints for carousel
  const CARD_WIDTH = 240;
  const CARD_GAP = 16;
  const CARD_PADDING = 16;
  useEffect(() => {
    if (carouselRef.current) {
      const containerWidth = carouselRef.current.offsetWidth;
      const totalContentWidth =
      allCards.length * CARD_WIDTH +
      (allCards.length - 1) * CARD_GAP +
      CARD_PADDING * 2;
      const maxDrag = Math.max(0, totalContentWidth - containerWidth);
      setDragConstraints({
        left: -maxDrag,
        right: 0
      });
    }
  }, [currentStep]);
  const subSteps = [
  {
    name: 'ฉีดน้ำแรงดันสูง',
    icon: Droplets
  },
  {
    name: 'ล้างโฟมสลายคราบ',
    icon: Sparkles
  },
  {
    name: 'ขัดล้างอัตโนมัติ',
    icon: Loader2
  },
  {
    name: 'เป่าแห้ง',
    icon: Wind
  }];

  // Handle auto-progress during 'working' step
  useEffect(() => {
    if (currentStep === 'working') {
      const duration = 5000; // 5 seconds total
      const interval = 50; // Update every 50ms
      const steps = duration / interval;
      let currentProgress = 0;
      const timer = setInterval(() => {
        currentProgress += 100 / steps;
        if (currentProgress >= 100) {
          clearInterval(timer);
          setProgress(100);
          setTimeout(() => setCurrentStep('complete'), 500);
        } else {
          setProgress(currentProgress);
          // Update sub-steps based on progress (0-25%, 25-50%, etc.)
          setCurrentSubStep(Math.floor(currentProgress / 25));
        }
      }, interval);
      return () => clearInterval(timer);
    }
  }, [currentStep]);
  const renderHeader = (title: string, showBack = true) =>
  <div className="flex items-center justify-between px-4 py-4 border-b border-app-dark bg-app-black/95 sticky top-0 z-50">
      {showBack ?
    <button
      onClick={onBack}
      className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors">
      
          <ChevronLeft size={24} />
        </button> :

    <div className="w-10" />
    }
      <h1 className="text-white font-bold text-lg">{title}</h1>
      <div className="w-10" /> {/* Spacer for centering */}
    </div>;

  const renderProgressBar = (stepIndex: number) =>
  <div className="flex gap-2 px-4 py-3 bg-app-black">
      {[0, 1, 2, 3].map((i) =>
    <div
      key={i}
      className="h-1.5 flex-1 rounded-full bg-app-dark overflow-hidden">
      
          <motion.div
        className="h-full bg-app-red"
        initial={{
          width: i < stepIndex ? '100%' : '0%'
        }}
        animate={{
          width: i <= stepIndex ? '100%' : '0%'
        }}
        transition={{
          duration: 0.3
        }} />
      
        </div>
    )}
    </div>;

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0
    })
  };
  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden relative">
      <AnimatePresence mode="wait" custom={1}>
        {/* STEP 1: SCAN */}
        {currentStep === 'scan' &&
        <motion.div
          key="scan"
          className="absolute inset-0 flex flex-col bg-app-black"
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          custom={1}
          transition={{
            duration: 0.3
          }}>
          
            {renderHeader('สแกนตู้ล้างรถ')}
            {renderProgressBar(0)}

            <div className="flex-1 flex flex-col items-center justify-center p-6">
              <div className="text-center mb-8">
                <h2 className="text-xl font-bold text-white mb-2">
                  สแกน QR Code ที่เครื่อง
                </h2>
                <p className="text-gray-400 text-sm">
                  หันกล้องไปที่ QR Code บนตู้ล้างรถอัตโนมัติ
                </p>
              </div>

              {/* Scanner Viewfinder */}
              <div className="relative w-64 h-64 mb-12">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-app-red rounded-tl-xl" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-app-red rounded-tr-xl" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-app-red rounded-bl-xl" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-app-red rounded-br-xl" />

                {/* Scanning line animation */}
                <motion.div
                className="absolute left-0 right-0 h-0.5 bg-app-red shadow-[0_0_15px_rgba(220,38,38,0.8)]"
                animate={{
                  top: ['0%', '100%', '0%']
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'linear'
                }} />
              

                <div className="absolute inset-4 bg-app-dark/50 rounded-lg flex items-center justify-center border border-white/10 backdrop-blur-sm">
                  <QrCode size={48} className="text-white/30" />
                </div>
              </div>

              <button
              onClick={() => setCurrentStep('payment')}
              className="w-full bg-app-red hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-900/50 flex items-center justify-center gap-2">
              
                <QrCode size={20} />
                จำลองการสแกนสำเร็จ
              </button>
            </div>
          </motion.div>
        }

        {/* STEP 2: PAYMENT */}
        {currentStep === 'payment' &&
        <motion.div
          key="payment"
          className="absolute inset-0 flex flex-col bg-app-black overflow-y-auto no-scrollbar"
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          custom={1}
          transition={{
            duration: 0.3
          }}>
          
            {renderHeader('เลือกบริการและชำระเงิน')}
            {renderProgressBar(1)}

            <div className="flex-1 flex flex-col gap-4 pb-4">
              {/* Card Carousel */}
              <div className="pt-4">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2 px-4">
                  <span className="w-1.5 h-4 bg-app-red rounded-full"></span>
                  เลื่อนเลือกแพ็กเกจ
                </h3>
                <div
                ref={carouselRef}
                className="relative w-full overflow-x-auto no-scrollbar">
                
                  <div className="flex gap-4 px-4 pb-4">
                    {allCards.map((card, idx) => {
                    const isSelected = selectedCardIndex === idx;
                    return (
                      <motion.div
                        key={card.id}
                        initial={{
                          opacity: 0,
                          scale: 0.85,
                          y: 30
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                          y: 0
                        }}
                        transition={{
                          delay: idx * 0.1,
                          type: 'spring',
                          stiffness: 250,
                          damping: 22
                        }}
                        onTap={() => handleCardSelect(idx)}
                        className={`shrink-0 relative rounded-2xl overflow-visible transition-all duration-500`}
                        style={{
                          width: CARD_WIDTH
                        }}>
                        
                          <motion.div
                          animate={
                          isSelected ?
                          {
                            scale: 1,
                            opacity: 1
                          } :
                          {
                            scale: 0.92,
                            opacity: 0.6
                          }
                          }
                          whileTap={{
                            scale: 0.95
                          }}
                          transition={{
                            duration: 0.3,
                            ease: 'easeInOut'
                          }}
                          className="relative z-10 rounded-2xl overflow-hidden">
                          
                            <img
                            src={card.image}
                            alt={card.name}
                            className="w-full h-auto object-cover pointer-events-none"
                            draggable={false} />
                          
                          </motion.div>

                          {/* Selected indicator */}
                          {isSelected &&
                        <motion.div
                          initial={{
                            scale: 0
                          }}
                          animate={{
                            scale: 1
                          }}
                          transition={{
                            type: 'spring',
                            stiffness: 400,
                            damping: 20
                          }}
                          className="absolute -top-1 -right-1 z-20 w-8 h-8 bg-app-red rounded-full flex items-center justify-center shadow-lg shadow-red-900/50 border-2 border-app-black">
                          
                              <CheckCircle2 size={16} className="text-white" />
                            </motion.div>
                        }
                        </motion.div>);

                  })}
                  </div>
                </div>

                {/* Dot indicators */}
                <div className="flex justify-center gap-2 mt-1">
                  {allCards.map((_, idx) =>
                <button
                  key={idx}
                  onClick={() => handleCardSelect(idx)}
                  className={`rounded-full transition-all duration-300 ${selectedCardIndex === idx ? 'w-6 h-2 bg-app-red' : 'w-2 h-2 bg-gray-600 hover:bg-gray-500'}`} />

                )}
                </div>

                {/* Selected card name */}
                <motion.p
                key={selectedCard.name}
                initial={{
                  opacity: 0,
                  y: 10
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                className="text-center text-white font-bold text-lg mt-3">
                
                  {selectedCard.name}
                  {selectedCard.isAddon &&
                <span className="text-xs text-gray-400 font-normal ml-2">
                      (บริการเสริม)
                    </span>
                }
                </motion.p>
              </div>

              <div className="px-4 flex flex-col gap-4">
                {/* Car Size Selector */}
                <div>
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-app-red rounded-full"></span>
                    เลือกขนาดรถ
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {carSizes.map((size, idx) =>
                  <motion.button
                    key={size.id}
                    initial={{
                      opacity: 0,
                      y: 20
                    }}
                    animate={{
                      opacity: 1,
                      y: 0
                    }}
                    transition={{
                      delay: 0.3 + idx * 0.08
                    }}
                    whileTap={{
                      scale: 0.95
                    }}
                    onClick={() => setCarSize(size.id)}
                    className={`relative py-3 px-2 rounded-xl border-2 text-center transition-all duration-300 ${carSize === size.id ? 'border-app-red bg-app-red/10 shadow-[0_0_20px_rgba(220,38,38,0.15)]' : 'border-white/5 bg-app-dark hover:border-white/15'}`}>
                    
                        <span
                      className={`text-2xl font-black block ${carSize === size.id ? 'text-app-red' : 'text-white'} transition-colors`}>
                      
                          {size.label}
                        </span>
                        <span className="text-[11px] text-gray-400 mt-0.5 block">
                          {size.desc}
                        </span>
                        <motion.span
                      key={`${selectedCard.id}-${size.id}`}
                      initial={{
                        scale: 1.3
                      }}
                      animate={{
                        scale: 1
                      }}
                      className={`text-xs font-bold block mt-1 ${carSize === size.id ? 'text-app-red' : 'text-gray-500'}`}>
                      
                          {selectedCard.prices[size.id]}฿
                        </motion.span>
                        {carSize === size.id &&
                    <motion.div
                      layoutId="sizeIndicator"
                      className="absolute -top-1 -right-1 w-5 h-5 bg-app-red rounded-full flex items-center justify-center"
                      transition={{
                        type: 'spring',
                        stiffness: 400,
                        damping: 25
                      }}>
                      
                            <CheckCircle2 size={12} className="text-white" />
                          </motion.div>
                    }
                      </motion.button>
                  )}
                  </div>
                </div>

                {/* Vacuum Add-on Toggle (only show if main package is selected, not vacuum card) */}
                {!selectedCard.isAddon &&
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                transition={{
                  delay: 0.5
                }}>
                
                    <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                      <span className="w-1.5 h-4 bg-app-red rounded-full"></span>
                      บริการเสริม
                    </h3>
                    <button
                  onClick={() => setAddVacuum(!addVacuum)}
                  className={`w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-300 ${addVacuum ? 'border-app-red bg-app-red/10' : 'border-white/5 bg-app-dark'}`}>
                  
                      <div className="flex items-center gap-3">
                        <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${addVacuum ? 'bg-app-red' : 'bg-app-black'}`}>
                      
                          <Wind
                        size={18}
                        className={
                        addVacuum ? 'text-white' : 'text-gray-400'
                        } />
                      
                        </div>
                        <div className="text-left">
                          <p className="text-white font-bold text-sm">
                            ดูดฝุ่นภายใน
                          </p>
                          <p className="text-[11px] text-gray-500">
                            ทำความสะอาดภายในรถ
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <motion.span
                      key={allCards[3].prices[carSize]}
                      initial={{
                        scale: 1.2
                      }}
                      animate={{
                        scale: 1
                      }}
                      className={`font-bold ${addVacuum ? 'text-app-red' : 'text-gray-400'}`}>
                      
                          +{allCards[3].prices[carSize]}฿
                        </motion.span>
                        <div
                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${addVacuum ? 'bg-app-red border-app-red' : 'border-gray-600'}`}>
                      
                          {addVacuum &&
                      <CheckCircle2 size={14} className="text-white" />
                      }
                        </div>
                      </div>
                    </button>
                  </motion.div>
              }

                {/* Payment Methods */}
                <div>
                  <h3 className="text-white font-bold mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-4 bg-app-red rounded-full"></span>
                    ช่องทางการชำระเงิน
                  </h3>
                  <div className="grid gap-2">
                    {paymentMethods.map((method, idx) => {
                    const Icon = method.icon;
                    return (
                      <motion.button
                        key={method.id}
                        initial={{
                          opacity: 0,
                          x: -20
                        }}
                        animate={{
                          opacity: 1,
                          x: 0
                        }}
                        transition={{
                          delay: 0.6 + idx * 0.08
                        }}
                        onClick={() => setSelectedPayment(method.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${selectedPayment === method.id ? 'bg-white/5 border-app-red' : 'bg-app-dark border-transparent'}`}>
                        
                          <div
                          className={`p-2 rounded-lg transition-colors ${selectedPayment === method.id ? 'bg-app-red text-white' : 'bg-app-black text-gray-400'}`}>
                          
                            <Icon size={20} />
                          </div>
                          <span className="text-white font-medium flex-1 text-left">
                            {method.name}
                          </span>
                          <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPayment === method.id ? 'border-app-red' : 'border-gray-600'}`}>
                          
                            {selectedPayment === method.id &&
                          <motion.div
                            initial={{
                              scale: 0
                            }}
                            animate={{
                              scale: 1
                            }}
                            className="w-2.5 h-2.5 rounded-full bg-app-red" />

                          }
                          </div>
                        </motion.button>);

                  })}
                  </div>
                </div>

                {/* Summary & Pay Button */}
                <motion.div
                initial={{
                  opacity: 0,
                  y: 20
                }}
                animate={{
                  opacity: 1,
                  y: 0
                }}
                transition={{
                  delay: 0.8
                }}
                className="pt-2 pb-4">
                
                  <div className="bg-app-dark rounded-xl p-4 mb-4 border border-white/5">
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">
                          {mainPackage.name} (ไซส์ {carSize})
                        </span>
                        <span className="text-white">
                          {mainPackage.prices[carSize]}฿
                        </span>
                      </div>
                      {addVacuum &&
                    <div className="flex justify-between text-sm">
                          <span className="text-gray-400">
                            ดูดฝุ่นภายใน (ไซส์ {carSize})
                          </span>
                          <span className="text-white">
                            {allCards[3].prices[carSize]}฿
                          </span>
                        </div>
                    }
                      <div className="border-t border-white/5 pt-2 flex justify-between items-center">
                        <span className="text-gray-400 font-medium">
                          ยอดชำระสุทธิ
                        </span>
                        <motion.span
                        key={totalPrice}
                        initial={{
                          scale: 1.3,
                          color: '#DC2626'
                        }}
                        animate={{
                          scale: 1,
                          color: '#ffffff'
                        }}
                        className="text-2xl font-black">
                        
                          {totalPrice}
                          <span className="text-sm font-normal text-gray-400 ml-1">
                            บาท
                          </span>
                        </motion.span>
                      </div>
                    </div>
                  </div>
                  <motion.button
                  whileHover={{
                    scale: 1.02
                  }}
                  whileTap={{
                    scale: 0.98
                  }}
                  onClick={() => setCurrentStep('working')}
                  className="w-full bg-app-red hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-900/50 flex items-center justify-center gap-2 text-lg">
                  
                    ชำระเงิน {totalPrice} บาท
                  </motion.button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        }

        {/* STEP 3: WORKING */}
        {currentStep === 'working' &&
        <motion.div
          key="working"
          className="absolute inset-0 flex flex-col bg-app-black"
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          custom={1}
          transition={{
            duration: 0.3
          }}>
          
            <div className="absolute inset-0 z-0">
              <video
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover">
              
                <source
                src="/freepik_cute-robot-mascot-roboss-washing-a-red-car-gentle-repeating-scrubbing-motion-on-the-car-door-seamless-loop-stable-side-view-fixed-camera-consistent-composition-small-natural-water-splashe_0001%20(1).mp4"
                type="video/mp4" />
              
              </video>
              {/* Dark gradient overlay to make text readable */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
            </div>

            <div className="relative z-10">
              {renderHeader('ระบบกำลังทำงาน', false)}
              {renderProgressBar(2)}
            </div>

            <div className="flex-1 flex flex-col items-center justify-between p-6 relative z-10">
              {/* Top Status Text */}
              <div className="text-center mt-4 bg-black/40 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10">
                <motion.h2
                key={currentSubStep}
                initial={{
                  y: -10,
                  opacity: 0
                }}
                animate={{
                  y: 0,
                  opacity: 1
                }}
                className="text-2xl font-bold text-white">
                
                  {subSteps[currentSubStep]?.name || 'กำลังดำเนินการ'}
                </motion.h2>
              </div>

              {/* Spacer to push content to bottom */}
              <div className="flex-1" />

              {/* Bottom Container: Progress + Timeline */}
              <div className="w-full max-w-sm bg-[#1A1A1A]/95 backdrop-blur-md rounded-3xl p-6 border border-white/5 shadow-2xl mb-4 flex flex-col gap-6">
                {/* Progress Bar Section */}
                <div className="flex flex-col items-center w-full">
                  <h3 className="text-lg font-bold text-white mb-3 animate-pulse">
                    กรุณารอสักครู่
                  </h3>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden relative">
                    <motion.div
                    className="absolute top-0 left-0 h-full bg-gradient-to-r from-app-red to-red-400 rounded-full"
                    style={{
                      width: `${progress}%`
                    }} />
                  
                    <motion.div
                    className="absolute top-0 bottom-0 w-20 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                    animate={{
                      left: ['-20%', '120%']
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: 'linear'
                    }} />
                  
                  </div>
                </div>

                {/* Redesigned Timeline */}
                <div className="flex justify-between relative pt-2">
                  {/* Progress Line Background */}
                  <div className="absolute top-6 left-6 right-6 h-0.5 bg-gray-800 -z-10" />

                  {/* Active Progress Line */}
                  <motion.div
                  className="absolute top-6 left-6 h-0.5 bg-app-red -z-10"
                  initial={{
                    width: '0%'
                  }}
                  animate={{
                    width: `${currentSubStep / (subSteps.length - 1) * 100}%`
                  }}
                  transition={{
                    duration: 0.5
                  }} />
                

                  {subSteps.map((step, idx) => {
                  const Icon = step.icon;
                  const isCompleted = currentSubStep > idx;
                  const isActive = currentSubStep === idx;
                  return (
                    <div
                      key={idx}
                      className="flex flex-col items-center gap-3 relative">
                      
                        <motion.div
                        animate={
                        isActive ?
                        {
                          scale: [1, 1.15, 1]
                        } :
                        {
                          scale: 1
                        }
                        }
                        transition={
                        isActive ?
                        {
                          repeat: Infinity,
                          duration: 2
                        } :
                        {}
                        }
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-500 ${isCompleted ? 'bg-app-red text-white shadow-[0_0_15px_rgba(220,38,38,0.6)]' : isActive ? 'bg-[#1A1A1A] text-app-red border-2 border-app-red shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-[#1A1A1A] text-gray-600 border-2 border-gray-800'}`}>
                        
                          {isCompleted ?
                        <CheckCircle2 size={20} strokeWidth={3} /> :

                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        }
                        </motion.div>

                        <span
                        className={`text-[11px] font-bold text-center w-16 transition-colors duration-300 leading-tight ${isCompleted ? 'text-white' : isActive ? 'text-app-red' : 'text-gray-600'}`}>
                        
                          {step.name}
                        </span>
                      </div>);

                })}
                </div>
              </div>
            </div>
          </motion.div>
        }

        {/* STEP 4: COMPLETE */}
        {currentStep === 'complete' &&
        <motion.div
          key="complete"
          className="absolute inset-0 flex flex-col bg-app-black"
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          custom={1}
          transition={{
            duration: 0.3
          }}>
          
            {renderHeader('เสร็จสิ้น', false)}
            {renderProgressBar(3)}

            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <motion.div
              initial={{
                scale: 0,
                opacity: 0
              }}
              animate={{
                scale: 1,
                opacity: 1
              }}
              transition={{
                type: 'spring',
                stiffness: 200,
                damping: 20,
                delay: 0.2
              }}
              className="w-24 h-24 bg-green-500/20 rounded-full flex items-center justify-center mb-6 border-2 border-green-500">
              
                <CheckCircle2 size={48} className="text-green-500" />
              </motion.div>

              <motion.h2
              initial={{
                y: 20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              transition={{
                delay: 0.4
              }}
              className="text-3xl font-black text-white mb-2">
              
                ล้างรถเสร็จสิ้น!
              </motion.h2>

              <motion.p
              initial={{
                y: 20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              transition={{
                delay: 0.5
              }}
              className="text-gray-400 mb-8">
              
                ขอบคุณที่ใช้บริการ ROBOSS
              </motion.p>

              <motion.div
              initial={{
                y: 20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              transition={{
                delay: 0.6
              }}
              className="w-full bg-app-dark rounded-2xl p-5 border border-white/5 mb-8">
              
                <div className="flex justify-between items-center py-2 border-b border-white/5 mb-2">
                  <span className="text-gray-400">บริการ</span>
                  <span className="text-white font-medium">
                    {mainPackage.name}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5 mb-2">
                  <span className="text-gray-400">ขนาดรถ</span>
                  <span className="text-white font-medium">ไซส์ {carSize}</span>
                </div>
                {addVacuum &&
              <div className="flex justify-between items-center py-2 border-b border-white/5 mb-2">
                    <span className="text-gray-400">บริการเสริม</span>
                    <span className="text-white font-medium">ดูดฝุ่นภายใน</span>
                  </div>
              }
                <div className="flex justify-between items-center py-2 border-b border-white/5 mb-2">
                  <span className="text-gray-400">ชำระผ่าน</span>
                  <span className="text-white font-medium">
                    {paymentMethods.find((m) => m.id === selectedPayment)?.name}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2">
                  <span className="text-gray-400">ยอดชำระสุทธิ</span>
                  <span className="text-app-red font-bold text-xl">
                    {totalPrice} ฿
                  </span>
                </div>
              </motion.div>

              <motion.button
              initial={{
                y: 20,
                opacity: 0
              }}
              animate={{
                y: 0,
                opacity: 1
              }}
              transition={{
                delay: 0.8
              }}
              onClick={onBack}
              className="w-full bg-app-red hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-900/50 mt-auto">
              
                กลับหน้าหลัก
              </motion.button>
            </div>
          </motion.div>
        }
      </AnimatePresence>
    </div>);

}