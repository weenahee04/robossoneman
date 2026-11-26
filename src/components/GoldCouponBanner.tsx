import React from 'react';
import { Link } from 'react-router-dom';
import './GoldCouponBanner.css';

const ticketPath = 'M5 7 Q5 5 7 5 H35 Q37 5 37 7 V13 C30 13 30 21 37 21 V27 Q37 29 35 29 H7 Q5 29 5 27 V21 C12 21 12 13 5 13 Z';

export function GoldCouponBanner() {
  return (
    <div className="gold-coupon-placement">
      <Link to="/coupon" className="gold-coupon" aria-label="รับสิทธิพิเศษเพิ่มเติม ด้วยคูปองของคุณ ดูรายละเอียด">
        <svg className="gold-coupon__art" viewBox="0 0 448 64" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="coupon-ticket-gold" x1="0" y1="0" x2="1" y2="0">
              <stop stopColor="#524124" stopOpacity="0" />
              <stop offset="1" stopColor="#bc934d" stopOpacity=".34" />
            </linearGradient>
          </defs>
          <path d="M210 64 304 0H330L239 64Z" fill="#8c7040" opacity=".04" />
          <path d="M260 64 345 0H352L270 64Z" fill="#ba924e" opacity=".05" />
          <g transform="translate(328 8) rotate(-12 55 25)">
            <path d="M0 3Q0 0 3 0H105Q109 0 109 4V14C99 14 99 30 109 30V46Q109 50 105 50H3Q0 50 0 47Z" fill="url(#coupon-ticket-gold)" />
            <path d="M78 1V49" stroke="#211c14" strokeWidth="1" strokeDasharray="3 3" />
          </g>
        </svg>
        <span className="gold-coupon__icon" aria-hidden="true">
          <svg viewBox="0 0 42 34" fill="none"><path d={ticketPath} transform="rotate(-8 21 17)" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" /></svg>
        </span>
        <span className="gold-coupon__copy"><strong>รับสิทธิพิเศษเพิ่มเติม</strong><span>ด้วยคูปองของคุณ</span></span>
        <span className="gold-coupon__cta">ดูรายละเอียด<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
      </Link>
    </div>
  );
}
