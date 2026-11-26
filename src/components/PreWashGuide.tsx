/* Hallmark · pre-emit critique: P5 H5 E5 S5 R5 V5 */
import type { MouseEventHandler, ReactNode } from 'react';
import './PreWashGuide.css';

export type PreWashGuideState = 'default' | 'loading' | 'error' | 'success';
export type PreWashGuidePreviewState = 'hover' | 'focus' | 'active';

interface PreWashGuideProps {
  isMotorcycle: boolean;
  state?: PreWashGuideState;
  previewState?: PreWashGuidePreviewState;
  disabled?: boolean;
  onStart?: MouseEventHandler<HTMLButtonElement>;
}

type GuideContent = {
  imageSrc: string;
  imageAlt: string;
  caption: string;
  facts: string[];
  steps: Array<{ title: string; detail: string }>;
  stopConditions: string[];
  afterStart: string;
  success: string;
};

const motorcycleGuide: GuideContent = {
  imageSrc: '/service-cards/motorcycle-prewash.webp',
  imageAlt: 'มอเตอร์ไซค์จอดตรงกึ่งกลางและอยู่ภายในกรอบสีแดงทั้งหมด',
  caption: 'ล้อหน้าและล้อหลังต้องอยู่ในกรอบสีแดงทั้งหมด',
  facts: ['คนออกจากพื้นที่ก่อนเริ่ม', 'รอเครื่องหยุดสนิทก่อนรับรถ'],
  steps: [
    {
      title: 'จอดให้ตรงกลางกรอบสีแดง',
      detail: 'ล้อหน้าและล้อหลังต้องไม่เลยเส้น จอดรถให้ตรงและตั้งขาตั้งให้มั่นคง',
    },
    {
      title: 'ปิดและเก็บของให้เรียบร้อย',
      detail: 'ปิดฝาถังน้ำมัน ช่องกุญแจ และนำของที่อาจหลุดออกจากตะกร้าหรือตัวรถ',
    },
    {
      title: 'ลงจากรถและออกจากช่องล้าง',
      detail: 'ตรวจให้แน่ใจว่าไม่มีคน สัตว์ หรือสิ่งกีดขวางอยู่ในพื้นที่ทำงานของเครื่อง',
    },
  ],
  stopConditions: [
    'ตัวรถหรือล้อส่วนใดส่วนหนึ่งอยู่นอกกรอบสีแดง',
    'เครื่องยังไม่อยู่ในตำแหน่งเริ่มต้นหรือมีสัญญาณผิดปกติ',
    'ยังมีคน สัตว์ หรือสิ่งของอยู่ในช่องล้าง',
  ],
  afterStart: 'รอประมาณ 3 นาที และนำรถออกเมื่อการเป่าลมเสร็จและเครื่องหยุดสนิทแล้วเท่านั้น',
  success: 'เครื่องรับคำสั่งแล้ว โปรดอยู่ด้านนอกช่องล้างจนกว่าเครื่องจะหยุดสนิท',
};

const carGuide: GuideContent = {
  imageSrc: '/service-cards/car-prewash-safety-v2.webp',
  imageAlt: 'รถยนต์จอดตรงกึ่งกลางและอยู่ภายในช่องล้างทั้งหมด',
  caption: 'รถทั้งคันต้องอยู่กึ่งกลางและไม่ล้ำพื้นที่ทำงานของเครื่อง',
  facts: ['อยู่ในรถตลอดการล้าง', 'ห้ามเปิดประตูหรือกระจก'],
  steps: [
    {
      title: 'จอดรถให้ตรงกึ่งกลางช่อง',
      detail: 'จัดรถตามแนวพื้นให้ตรง ล้อตรง และตรวจว่าตัวรถทั้งคันอยู่ภายในพื้นที่ที่กำหนด',
    },
    {
      title: 'ปิดรถให้เรียบร้อย',
      detail: 'ปิดประตู กระจก และหลังคา พับกระจกมองข้าง พร้อมเก็บเสาอากาศหรือของภายนอกที่อาจหลุด',
    },
    {
      title: 'อยู่ในรถตลอดการล้าง',
      detail: 'ห้ามเปิดประตูหรือกระจก และตรวจให้แน่ใจว่าไม่มีคนหรือสิ่งของอยู่รอบพื้นที่ทำงานของเครื่อง',
    },
  ],
  stopConditions: [
    'รถเอียง จอดไม่กึ่งกลาง หรือตัวรถส่วนใดอยู่นอกแนวที่กำหนด',
    'ประตู กระจก หรือหลังคายังปิดไม่สนิท หรือมีของภายนอกรถที่อาจหลุด',
    'เครื่องยังไม่พร้อม หรือมีคนและสิ่งกีดขวางอยู่ในพื้นที่ทำงาน',
  ],
  afterStart: 'อยู่ในรถตลอดการล้าง ห้ามเปิดประตูหรือกระจก และรอจนระบบแจ้งว่าเสร็จสิ้น',
  success: 'เครื่องรับคำสั่งแล้ว โปรดอยู่ในรถและรอจนระบบแจ้งว่าเสร็จสิ้น',
};

const actionLabels: Record<PreWashGuideState, string> = {
  default: 'ยืนยันและเริ่มล้าง',
  loading: 'กำลังเริ่มเครื่อง…',
  error: 'ลองเริ่มอีกครั้ง',
  success: 'เริ่มล้างแล้ว',
};

function AlertIcon(): ReactNode {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <path d="M12 3 2.7 20h18.6L12 3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

export function PreWashGuide({
  isMotorcycle,
  state = 'default',
  previewState,
  disabled = false,
  onStart,
}: PreWashGuideProps) {
  const guide = isMotorcycle ? motorcycleGuide : carGuide;
  const forcedStateClass = previewState ? `is-${previewState}` : '';
  const isDisabled = disabled || state === 'loading';

  return (
    <section className="prewash-guide" aria-labelledby="prewash-guide-title">
      <header className="prewash-guide__header">
        <span className="prewash-guide__signal">ขั้นตอนความปลอดภัย</span>
        <h2 id="prewash-guide-title">กรุณาจอดให้ตรงช่อง</h2>
        <p>ตรวจตำแหน่งรถและพื้นที่รอบเครื่องให้ครบก่อนกดเริ่ม เพื่อความปลอดภัยของคุณและตัวรถ</p>
      </header>

      <figure className="prewash-guide__visual">
        <img
          src={guide.imageSrc}
          alt={guide.imageAlt}
          width="1280"
          height="720"
          fetchPriority="high"
          draggable={false}
        />
        <figcaption>
          <span className="prewash-guide__check" aria-hidden="true">✓</span>
          <span>{guide.caption}</span>
        </figcaption>
      </figure>

      <div className="prewash-guide__facts" aria-label="ข้อควรจำ">
        {guide.facts.map((fact) => (
          <span key={fact}>
            <span aria-hidden="true">✓</span>
            {fact}
          </span>
        ))}
      </div>

      <section className="prewash-guide__checklist" aria-labelledby="prewash-checklist-title">
        <div className="prewash-guide__section-heading">
          <span>01</span>
          <h3 id="prewash-checklist-title">ตรวจ 3 จุดก่อนเริ่ม</h3>
        </div>
        <ol className="prewash-guide__steps">
          {guide.steps.map((step, index) => (
            <li key={step.title}>
              <span className="prewash-guide__step-number" aria-hidden="true">{index + 1}</span>
              <span className="prewash-guide__step-copy">
                <strong>{step.title}</strong>
                <span>{step.detail}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <aside className="prewash-guide__warning" aria-labelledby="prewash-warning-title">
        <div className="prewash-guide__warning-heading">
          <span className="prewash-guide__warning-icon"><AlertIcon /></span>
          <span>
            <small>คำเตือน</small>
            <strong id="prewash-warning-title">ยังห้ามกดเริ่ม หาก…</strong>
          </span>
        </div>
        <ul>
          {guide.stopConditions.map((condition) => <li key={condition}>{condition}</li>)}
        </ul>
      </aside>

      <aside className="prewash-guide__after-start" aria-label="สิ่งที่ต้องทำหลังเริ่มล้าง">
        <span>หลังเริ่มล้าง</span>
        <p>{guide.afterStart}</p>
      </aside>

      <div className="prewash-guide__action-area">
        {state === 'error' && (
          <p className="prewash-guide__status prewash-guide__status--error" role="alert">
            เครื่องยังไม่เริ่มทำงาน โปรดตรวจตำแหน่งรถและความพร้อมของเครื่อง แล้วลองอีกครั้ง
          </p>
        )}
        {state === 'success' && (
          <p className="prewash-guide__status prewash-guide__status--success" role="status">
            {guide.success}
          </p>
        )}
        <button
          type="button"
          className={`prewash-guide__start ${forcedStateClass}`}
          data-state={state}
          disabled={isDisabled}
          aria-busy={state === 'loading'}
          onClick={onStart}
        >
          <span>{actionLabels[state]}</span>
          <span className="prewash-guide__start-icon" aria-hidden="true">
            {state === 'loading' || state === 'error' ? '' : state === 'success' ? '✓' : '→'}
          </span>
        </button>
        <p className="prewash-guide__action-note">เมื่อกดแล้ว เครื่องจะเริ่มทำงานทันที</p>
      </div>
    </section>
  );
}
