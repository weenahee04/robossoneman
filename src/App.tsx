import React, { useState } from 'react';
import { Header } from './components/Header';
import { HeroBanner } from './components/HeroBanner';
import { CategoryGrid } from './components/CategoryGrid';
import { MemberBanner } from './components/MemberBanner';
import { ProductCategories } from './components/ProductCategories';
import { CarWashFlow } from './pages/CarWashFlow';
import { CouponPage } from './pages/CouponPage';
import { NearbyBranches } from './pages/NearbyBranches';
import { MemberCard } from './pages/MemberCard';
import { PromotionPage } from './pages/PromotionPage';
export function App() {
  const [currentView, setCurrentView] = useState<
    'home' | 'carwash' | 'coupon' | 'branches' | 'member' | 'promotion'>(
    'home');
  return (
    <div className="min-h-screen bg-black flex justify-center w-full font-sans selection:bg-app-red selection:text-white">
      {/* Mobile constraint container */}
      <div className="w-full max-w-[430px] bg-app-black min-h-screen relative shadow-2xl overflow-x-hidden flex flex-col">
        {currentView === 'home' ?
        <>
            <Header />
            <main className="flex-1 overflow-y-auto no-scrollbar pb-10">
              <HeroBanner />
              <CategoryGrid
              onNavigate={() => setCurrentView('carwash')}
              onNavigateCoupon={() => setCurrentView('coupon')}
              onNavigateBranches={() => setCurrentView('branches')}
              onNavigateMember={() => setCurrentView('member')}
              onNavigatePromotion={() => setCurrentView('promotion')} />
            
              <MemberBanner />
              <ProductCategories />

              {/* Bottom padding/spacer */}
              <div className="h-8 flex items-center justify-center">
                <div className="w-1/3 h-1 bg-app-dark rounded-full"></div>
              </div>
            </main>
          </> :
        currentView === 'carwash' ?
        <CarWashFlow onBack={() => setCurrentView('home')} /> :
        currentView === 'coupon' ?
        <CouponPage onBack={() => setCurrentView('home')} /> :
        currentView === 'branches' ?
        <NearbyBranches onBack={() => setCurrentView('home')} /> :
        currentView === 'member' ?
        <MemberCard onBack={() => setCurrentView('home')} /> :

        <PromotionPage onBack={() => setCurrentView('home')} />
        }
      </div>
    </div>);

}