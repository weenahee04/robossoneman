import React from 'react';
import { Filter, Plus, Search } from 'lucide-react';
import { pageMeta, type PageName } from '../src/App';

interface Props {
  page: Exclude<PageName, 'dashboard'>;
}

const createLabels: Partial<Record<PageName, string>> = {
  branches: 'เพิ่มสาขา',
  admins: 'เพิ่มผู้ดูแล',
  packages: 'เพิ่มบริการ',
  coupons: 'สร้างคูปอง',
  rewards: 'เพิ่มรางวัล',
  promotions: 'สร้างโปรโมชัน',
  notifications: 'สร้างประกาศ',
  'membership-plans': 'เพิ่มแผนสมาชิก',
  content: 'เพิ่มเนื้อหา',
};

const settingsPages = new Set<PageName>([
  'payment-setup', 'policies', 'membership-plans', 'content',
]);

export function QAModulePage({ page }: Props) {
  const meta = pageMeta[page];
  const isSettings = settingsPages.has(page);

  return (
    <div className="qa-module">
      <header className="qa-module__head">
        <div>
          <h2>{meta.title}</h2>
          <p>{meta.description}</p>
        </div>
        {createLabels[page] && (
          <button type="button" className="qa-module__primary">
            <Plus aria-hidden="true" />
            <span>{createLabels[page]}</span>
          </button>
        )}
      </header>

      {isSettings ? (
        <section className="qa-module__settings" aria-label={`ตัวอย่างหน้า${meta.title}`}>
          <nav aria-label="หัวข้อการตั้งค่า">
            <button type="button" aria-current="page">ข้อมูลหลัก</button>
            <button type="button">สิทธิ์และขอบเขต</button>
            <button type="button">ประวัติการแก้ไข</button>
          </nav>
          <div className="qa-module__settings-body">
            <div>
              <h3>ข้อมูลหลัก</h3>
              <p>พื้นที่ทำงานตัวอย่างสำหรับหน้า {meta.title}</p>
            </div>
            <label>ชื่อรายการ<input type="text" placeholder="กรอกชื่อรายการ" /></label>
            <label>สถานะ<select defaultValue="active"><option value="active">เปิดใช้งาน</option><option value="inactive">ปิดใช้งาน</option></select></label>
            <div className="qa-module__form-actions"><button type="button">ยกเลิก</button><button type="button" className="qa-module__primary">บันทึก</button></div>
          </div>
        </section>
      ) : (
        <>
          <section className="qa-module__summary" aria-label="สรุปข้อมูลตัวอย่าง">
            <div><span>รายการทั้งหมด</span><strong>—</strong><small>รอข้อมูลจากระบบจริง</small></div>
            <div><span>ต้องตรวจสอบ</span><strong>—</strong><small>ไม่มีข้อมูลในโหมดตัวอย่าง</small></div>
            <div><span>อัปเดตวันนี้</span><strong>—</strong><small>ข้อมูลจำลองไม่บันทึกจริง</small></div>
          </section>

          <section className="qa-module__body">
            <div className="qa-module__toolbar">
              <label><Search aria-hidden="true" /><input type="search" placeholder={`ค้นหา${meta.title}`} /></label>
              <button type="button"><Filter aria-hidden="true" /><span>ตัวกรอง</span></button>
            </div>
            <div className="qa-module__tabs" role="tablist" aria-label="กรองรายการ">
              <button type="button" role="tab" aria-selected="true">ทั้งหมด</button>
              <button type="button" role="tab" aria-selected="false">ใช้งานอยู่</button>
              <button type="button" role="tab" aria-selected="false">ต้องตรวจสอบ</button>
            </div>
            <div className="qa-module__table-wrap">
              <table className="qa-module__table">
                <thead><tr><th>รายการ</th><th>สถานะ</th><th>อัปเดตล่าสุด</th><th>การทำงาน</th></tr></thead>
                <tbody><tr><td colSpan={4}><div className="qa-module__empty"><strong>ตัวอย่างหน้า {meta.title}</strong><span>หน้านี้แสดงโครงสร้างและการนำทางเท่านั้น ข้อมูลจริงจะมาจาก API หลังเข้าสู่ระบบ</span></div></td></tr></tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
