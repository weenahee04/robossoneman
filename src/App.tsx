import React, { useState, useEffect } from 'react';
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
import { ArticlePage } from './pages/ArticlePage';
import { LoadingScreen } from './components/LoadingScreen';
export function App() {
  const [currentView, setCurrentView] = useState<
    'home' | 'carwash' | 'coupon' | 'branches' | 'member' | 'promotion' | 'article'>(
    'home');
  const [loading, setLoading] = useState(true);

  const navigateTo = (view: typeof currentView) => {
    setLoading(true);
    setCurrentView(view);
    setTimeout(() => setLoading(false), 1500);
  };

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 2500);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="min-h-screen bg-black flex justify-center w-full font-sans selection:bg-app-red selection:text-white">
      {loading && <LoadingScreen />}
      {/* Mobile constraint container */}
      <div className="w-full max-w-[430px] bg-app-black min-h-screen relative shadow-2xl overflow-x-hidden flex flex-col">
        {currentView === 'home' ?
        <>
            <Header />
            <main className="flex-1 overflow-y-auto no-scrollbar pb-10">
              <HeroBanner />
              <CategoryGrid
              onNavigate={() => navigateTo('carwash')}
              onNavigateCoupon={() => navigateTo('coupon')}
              onNavigateBranches={() => navigateTo('branches')}
              onNavigateMember={() => navigateTo('member')}
              onNavigatePromotion={() => navigateTo('promotion')}
              onNavigateArticle={() => navigateTo('article')} />
            
              <MemberBanner />
              <ProductCategories />

              {/* Bottom padding/spacer */}
              <div className="h-8 flex items-center justify-center">
                <div className="w-1/3 h-1 bg-app-dark rounded-full"></div>
              </div>
            </main>
          </> :
        currentView === 'carwash' ?
        <CarWashFlow onBack={() => navigateTo('home')} /> :
        currentView === 'coupon' ?
        <CouponPage onBack={() => navigateTo('home')} /> :
        currentView === 'branches' ?
        <NearbyBranches onBack={() => navigateTo('home')} /> :
        currentView === 'member' ?
        <MemberCard onBack={() => navigateTo('home')} /> :
        currentView === 'article' ?
        <ArticlePage onBack={() => navigateTo('home')} /> :
<PromotionPage onBack={() => navigateTo('home')} />
        }
      </div>
    </div>);

}