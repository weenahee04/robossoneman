/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import type { MouseEventHandler } from 'react';
import './WashPackageCardClassic.css';

export type WashPackageCardState = 'default' | 'loading' | 'error' | 'success';
export type WashPackageCardPreviewState = 'hover' | 'focus' | 'active';
export type WashPackageCardVariant = 'core' | 'shine' | 'signature';
export type WashPackageCardArtworkMode = 'full' | 'template' | 'text';

interface WashPackageCardProps {
  name: string;
  description: string;
  steps: readonly string[];
  imageSrc: string;
  price: number;
  durationLabel: string;
  badge: string;
  artworkSrc?: string;
  artworkMode?: WashPackageCardArtworkMode;
  variant?: WashPackageCardVariant;
  seriesCode?: string;
  positionLabel?: string;
  selected?: boolean;
  motorcycle?: boolean;
  state?: WashPackageCardState;
  previewState?: WashPackageCardPreviewState;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

const stateLabels: Record<Exclude<WashPackageCardState, 'default'>, string> = {
  loading: 'กำลังเลือกแพ็กเกจ…',
  error: 'เลือกไม่ได้ กรุณาลองอีกครั้ง',
  success: 'เลือกแพ็กเกจนี้แล้ว',
};

const variantLabels: Record<WashPackageCardVariant, string> = {
  core: 'CORE',
  shine: 'SHINE',
  signature: 'SIGNATURE',
};

const variantMarks: Record<WashPackageCardVariant, number> = {
  core: 1,
  shine: 2,
  signature: 3,
};

export function WashPackageCard({
  name,
  description,
  steps,
  imageSrc,
  price,
  durationLabel,
  badge,
  artworkSrc,
  artworkMode = 'template',
  variant = 'core',
  seriesCode = 'RB-01',
  positionLabel,
  selected = false,
  motorcycle = false,
  state = 'default',
  previewState,
  disabled = false,
  onClick,
}: WashPackageCardProps) {
  const forcedStateClass = previewState ? `is-${previewState}` : '';
  const isChosen = selected || state === 'success';
  const displayName = artworkMode === 'text' ? name.replace(/\s+\d+$/, '') : name;

  return (
    <button
      type="button"
      role="radio"
      aria-label={`${name} เริ่มต้น ${price.toLocaleString('th-TH')} บาท ${description}`}
      aria-checked={isChosen}
      tabIndex={isChosen ? 0 : -1}
      aria-busy={state === 'loading'}
      className={`wash-package-card ${motorcycle ? 'wash-package-card--motorcycle' : ''} ${forcedStateClass}`}
      data-state={state}
      data-selected={isChosen}
      data-variant={variant}
      data-artwork={artworkMode}
      disabled={disabled || state === 'loading'}
      onClick={onClick}
    >
      {artworkSrc ? (
        <img className="wash-package-card__artwork" src={artworkSrc} alt="" aria-hidden="true" draggable={false} />
      ) : null}

      <span className="wash-package-card__collector-rail" aria-hidden="true">
        <span>ROBOSS // {motorcycle ? 'MOTO' : 'WASH'} SERIES</span>
        <strong>{seriesCode}</strong>
      </span>

      {artworkMode === 'template' ? (
        <span className="wash-package-card__media" aria-hidden="true">
          <img src={imageSrc} alt="" width="960" height="640" loading="lazy" draggable={false} />
          <span className="wash-package-card__shade" />
          <span className="wash-package-card__badge">{badge}</span>
          {positionLabel ? <span className="wash-package-card__position">{positionLabel}</span> : null}
        </span>
      ) : null}

      {artworkMode !== 'full' ? <span className="wash-package-card__content">
        <span className="wash-package-card__identity" aria-hidden="true">
          <span>{variantLabels[variant]} · {badge}</span>
          <span className="wash-package-card__marks">
            {Array.from({ length: 3 }, (_, markIndex) => (
              <i key={markIndex} data-lit={markIndex < variantMarks[variant]} />
            ))}
          </span>
        </span>

        <span className="wash-package-card__heading-row">
          <span className="wash-package-card__name">{displayName}</span>
          <span className="wash-package-card__price">
            <small>เริ่มต้น</small>
            <strong>฿{price.toLocaleString('th-TH')}</strong>
          </span>
        </span>

        <span className="wash-package-card__description">{description}</span>

        <span className="wash-package-card__facts" aria-hidden="true">
          <span><small>เวลา</small><strong>{durationLabel}</strong></span>
          <span><small>ระบบ</small><strong>{steps.length} ขั้นตอน</strong></span>
        </span>

        <span className="wash-package-card__steps" aria-label={`ขั้นตอน: ${steps.join(', ')}`}>
          {steps.slice(0, 4).map((step) => (
            <span key={step}>{step}</span>
          ))}
          {steps.length > 4 ? <span>+{steps.length - 4} ขั้นตอน</span> : null}
        </span>

      </span> : null}

      <span className="wash-package-card__footer">
        <span className="wash-package-card__duration">
          {artworkMode === 'full' ? `เริ่มต้น ฿${price.toLocaleString('th-TH')}` : 'เลือกแพ็กเกจนี้'}
        </span>
        <span className="wash-package-card__choose" aria-hidden="true">
          <span className="wash-package-card__choose-icon">{isChosen ? '✓' : '→'}</span>
          <span>{isChosen ? 'เลือกแล้ว' : 'แตะเพื่อเลือก'}</span>
        </span>
      </span>

      {state !== 'default' ? (
        <span className="wash-package-card__status" role="status">
          {stateLabels[state]}
        </span>
      ) : null}
    </button>
  );
}
