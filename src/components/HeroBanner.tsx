import React, { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import './HeroBanner.css';

const slides = [
  { src: '/roboss-motorcycle-promo-gold-v1.png', label: 'โปรโมชั่นจาก ROBOSS', alt: 'โปรโมชั่นจาก ROBOSS ดูรายละเอียด — มอเตอร์ไซค์แดงในสายน้ำ', fit: 'cover' as const },
  { src: '/freepik_assistant_1774454922406.png', label: 'ล้างรถยนต์อัตโนมัติ', alt: 'ROBOSS ล้างรถยนต์อัตโนมัติ เริ่มต้น 99 บาท', fit: 'contain' as const },
];

export function HeroBanner() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const selectSlide = (index: number) => {
    const element = track.current;
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ left: element.clientWidth * index, behavior: reducedMotion ? 'instant' : 'smooth' });
  };

  return (
    <section className="promo-carousel" aria-label="โปรโมชั่น ROBOSS" aria-roledescription="สไลด์">
      <div className="promo-carousel__track" ref={track} tabIndex={0}
        onScroll={event => {
          const element = event.currentTarget;
          if (element.clientWidth) setActive(Math.max(0, Math.min(slides.length - 1, Math.round(element.scrollLeft / element.clientWidth))));
        }}
        onKeyDown={event => {
          if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
          event.preventDefault();
          selectSlide((active + (event.key === 'ArrowRight' ? 1 : -1) + slides.length) % slides.length);
        }}>
        {slides.map((slide, index) => (
          <div key={slide.src} className="promo-carousel__slide" role="group" aria-roledescription="สไลด์" aria-label={`${index + 1} จาก ${slides.length}: ${slide.label}`}>
            <Link to="/promotion" aria-label={`${slide.label} ดูรายละเอียด`} tabIndex={active === index ? 0 : -1}>
              <img src={slide.src} alt={slide.alt} style={{ objectFit: slide.fit }} fetchPriority={index === 0 ? 'high' : 'auto'} draggable={false} />
            </Link>
          </div>
        ))}
      </div>
      <div className="promo-carousel__dots" role="group" aria-label="เลือกแบนเนอร์">
        {slides.map((slide, index) => (
          <button key={slide.src} type="button" onClick={() => selectSlide(index)} aria-label={`แสดงแบนเนอร์ ${index + 1}: ${slide.label}`} aria-pressed={active === index}><span /></button>
        ))}
      </div>
    </section>
  );
}
