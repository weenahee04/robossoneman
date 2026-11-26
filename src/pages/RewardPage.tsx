import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getIconUrl } from '../services/icons';
import { formatPoints, getUserPoints, listenToUser } from '../services/points';
import {
  getRewardPackHistory,
  getRewardPackPrizes,
  openLocalRewardPack,
  REWARD_PACK_COST,
  type RewardPackOpening,
} from '../services/reward';
import './RewardPage.css';

type RewardPhase = 'idle' | 'opening' | 'revealed' | 'error';

function formatOpenedAt(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RewardPage({ onBack }: { onBack: () => void }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const revealTimer = useRef<number | null>(null);
  const [points, setPoints] = useState(getUserPoints());
  const [phase, setPhase] = useState<RewardPhase>('idle');
  const [result, setResult] = useState<RewardPackOpening | null>(null);
  const [history, setHistory] = useState(getRewardPackHistory());
  const [error, setError] = useState('');
  const prizes = getRewardPackPrizes();
  const canOpen = points >= REWARD_PACK_COST;

  useEffect(() => listenToUser((user) => setPoints(user.points)), []);

  useEffect(() => () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
  }, []);

  const handleOpen = () => {
    if (phase === 'opening') return;
    if (!canOpen) {
      setError(`ต้องการอีก ${formatPoints(REWARD_PACK_COST - points)} พอยท์เพื่อเปิดซอง`);
      setPhase('error');
      return;
    }

    try {
      const opening = openLocalRewardPack();
      if (!opening) {
        setError('พอยท์ไม่เพียงพอ กรุณาตรวจสอบยอดแล้วลองอีกครั้ง');
        setPhase('error');
        return;
      }
      setResult(opening);
      setError('');
      setPhase('opening');
      revealTimer.current = window.setTimeout(() => {
        setHistory(getRewardPackHistory());
        setPhase('revealed');
      }, reduceMotion ? 140 : 1050);
    } catch {
      setError('เปิดซองไม่สำเร็จ ระบบคืนพอยท์ให้แล้ว กรุณาลองอีกครั้ง');
      setPhase('error');
    }
  };

  const resetPack = () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
    setResult(null);
    setError('');
    setPhase('idle');
  };

  const packMotion = reduceMotion
    ? { opacity: phase === 'opening' ? 0 : 1 }
    : phase === 'opening'
      ? { y: [0, -8, 2], rotate: [0, -1.5, 0], scale: [1, 0.97, 1.02], opacity: [1, 0.86, 0] }
      : { y: 0, rotate: 0, scale: 1, opacity: 1 };

  return (
    <div className="reward-page">
      <header className="reward-page__header">
        <button className="reward-page__back" type="button" onClick={onBack} aria-label="กลับหน้าหลัก">
          <img src={getIconUrl('back', 44)} alt="" width="22" height="22" />
        </button>
        <div>
          <p className="reward-page__header-kicker">ROBOSS MEMBER</p>
          <h1>Reward</h1>
        </div>
        <button className="reward-page__coupon-link" type="button" onClick={() => navigate('/coupon')}>
          คูปองของฉัน
        </button>
      </header>

      <main className="reward-page__scroll">
        <div className="reward-page__inner">
          <section className="reward-balance" aria-label="ยอดพอยท์">
            <div>
              <span>พอยท์ที่ใช้ได้</span>
              <strong>{formatPoints(points)}</strong>
            </div>
            <p>เปิดซองละ <b>{formatPoints(REWARD_PACK_COST)}</b> พอยท์</p>
          </section>

          <section className="reward-workbench" aria-labelledby="reward-title">
            <div className="reward-workbench__intro">
              <p className="reward-workbench__kicker">PACK 01 · COUPON DROP</p>
              <h2 id="reward-title">เปิดซอง<br />รับคูปองล้างรถ</h2>
              <p>ใช้พอยท์เปิด 1 ซอง รับคูปองสุ่ม 1 ใบ และบันทึกเข้า “คูปองของฉัน” ทันที</p>
            </div>

            <div className="reward-workbench__stage" aria-live="polite">
              <AnimatePresence mode="wait">
                {phase !== 'revealed' ? (
                  <motion.button
                    key="pack"
                    className="reward-pack"
                    type="button"
                    onClick={handleOpen}
                    disabled={!canOpen || phase === 'opening'}
                    data-state={phase}
                    aria-label={`เปิดซอง Reward ใช้ ${REWARD_PACK_COST} พอยท์`}
                    animate={packMotion}
                    transition={reduceMotion
                      ? { duration: 0.14 }
                      : { duration: 1, ease: [0.16, 1, 0.3, 1], times: [0, 0.45, 1] }}
                  >
                    <span className="reward-pack__visual">
                      <img
                        src="/rewards/roboss-premium-pack.png"
                        alt="ซองการ์ด ROBOSS Premium สีดำ แดง และทอง"
                        width="1080"
                        height="1440"
                      />
                    </span>
                    <span className="reward-pack__action">
                      {phase === 'opening' ? 'กำลังเปิดซอง...' : canOpen ? `แตะเพื่อเปิด · ${REWARD_PACK_COST} พอยท์` : 'พอยท์ยังไม่พอ'}
                    </span>
                  </motion.button>
                ) : result ? (
                  <motion.article
                    key="result"
                    className="reward-result"
                    data-rarity={result.prize.rarity}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, rotate: -0.8 }}
                    animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, rotate: 0 }}
                    transition={{ duration: reduceMotion ? 0.14 : 0.52, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="reward-result__edition">
                      <span>ROBOSS COUPON</span>
                      <span>{result.prize.rarity.toUpperCase()}</span>
                    </div>
                    <div className="reward-result__mark" aria-hidden="true">R</div>
                    <p className="reward-result__value">{result.prize.valueLabel}</p>
                    <h3>{result.prize.title}</h3>
                    <p className="reward-result__description">{result.prize.description}</p>
                    <div className="reward-result__rule" aria-hidden="true" />
                    <dl>
                      <div><dt>ขั้นต่ำ</dt><dd>{result.prize.minSpend} บาท</dd></div>
                      <div><dt>ใช้ได้</dt><dd>{result.prize.validDays} วัน</dd></div>
                    </dl>
                    <code>{result.couponCode}</code>
                    <p className="reward-result__saved">บันทึกเข้าคูปองของฉันแล้ว</p>
                  </motion.article>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="reward-workbench__controls">
              {phase === 'revealed' ? (
                <>
                  <button className="reward-button reward-button--primary" type="button" onClick={() => navigate('/coupon')}>
                    ดูคูปองของฉัน
                  </button>
                  <button className="reward-button reward-button--secondary" type="button" onClick={resetPack} disabled={!canOpen}>
                    เปิดอีกซอง
                  </button>
                </>
              ) : !canOpen ? (
                <button className="reward-button reward-button--primary" type="button" onClick={() => navigate('/pointsshop')}>
                  ไปหาแต้มเพิ่ม
                </button>
              ) : null}
              {error ? <p className="reward-workbench__error" role="alert">{error}</p> : null}
            </div>
          </section>

          <section className="reward-ledger" aria-labelledby="reward-prizes-title">
            <header>
              <p>IN THIS PACK</p>
              <h2 id="reward-prizes-title">คูปองที่มีโอกาสได้รับ</h2>
            </header>
            <div className="reward-ledger__rows">
              {prizes.map((prize) => (
                <div className="reward-ledger__row" key={prize.rewardId}>
                  <span>{prize.valueLabel}</span>
                  <div><strong>{prize.title}</strong><small>ใช้ได้ {prize.validDays} วัน</small></div>
                  <em>{prize.rarity}</em>
                </div>
              ))}
            </div>
          </section>

          {history.length > 0 ? (
            <section className="reward-history" aria-labelledby="reward-history-title">
              <header>
                <p>RECENT DROPS</p>
                <h2 id="reward-history-title">ซองที่เปิดล่าสุด</h2>
              </header>
              <div>
                {history.slice(0, 4).map((opening) => (
                  <button key={opening.id} type="button" onClick={() => navigate('/coupon')}>
                    <span>{opening.prize.valueLabel}</span>
                    <strong>{opening.prize.title}</strong>
                    <time dateTime={opening.openedAt}>{formatOpenedAt(opening.openedAt)}</time>
                  </button>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
    </div>
  );
}
