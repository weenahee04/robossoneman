/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V4 */
import type { MouseEventHandler } from 'react';
import './WashGoalCard.css';

export type WashGoalCardTone = 'express' | 'recommended' | 'premium';
export type WashGoalCardState = 'default' | 'loading' | 'error' | 'success';
export type WashGoalCardPreviewState = 'hover' | 'focus' | 'active';

interface WashGoalCardProps {
  title: string;
  description: string;
  detail: string;
  badge: string;
  imageSrc: string;
  tone?: WashGoalCardTone;
  state?: WashGoalCardState;
  previewState?: WashGoalCardPreviewState;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const stateLabels: Record<Exclude<WashGoalCardState, 'default'>, string> = {
  loading: 'กำลังเปิดตัวเลือก…',
  error: 'เปิดตัวเลือกไม่ได้ ลองอีกครั้ง',
  success: 'เลือกบริการนี้แล้ว',
};

export function WashGoalCard({
  title,
  description,
  detail,
  badge,
  imageSrc,
  tone = 'express',
  state = 'default',
  previewState,
  disabled = false,
  onClick,
}: WashGoalCardProps) {
  const forcedStateClass = previewState ? `is-${previewState}` : '';

  return (
    <button
      type="button"
      className={`wash-goal-card wash-goal-card--${tone} ${forcedStateClass}`}
      data-state={state}
      disabled={disabled || state === 'loading'}
      aria-busy={state === 'loading'}
      onClick={onClick}
    >
      <span className="wash-goal-card__media" aria-hidden="true">
        <img
          src={imageSrc}
          alt=""
          width="1280"
          height="560"
          loading="lazy"
          draggable={false}
        />
        <span className="wash-goal-card__badge">{badge}</span>
      </span>

      <span className="wash-goal-card__body">
        <span className="wash-goal-card__title">{title}</span>
        <span className="wash-goal-card__description">{description}</span>
        <span className="wash-goal-card__detail">{detail}</span>
        {state !== 'default' && (
          <span className="wash-goal-card__status" role="status">
            {stateLabels[state]}
          </span>
        )}
      </span>

      <span className="wash-goal-card__action" aria-hidden="true">
        <span className="wash-goal-card__action-label">กดเลือกบริการนี้</span>
        <span className="wash-goal-card__action-arrow">→</span>
      </span>
    </button>
  );
}
