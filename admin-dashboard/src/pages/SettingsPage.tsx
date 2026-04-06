// TODO: Wire to admin API when settings endpoints are available.
// Currently using local state only — no matching admin endpoints yet.
import React, { useState } from 'react';
import { Settings, Shield, Bell, Wifi, Database, Save, ChevronRight, CheckCircle2, AlertTriangle, Activity, Cpu, PlugZap, RefreshCw, Power } from 'lucide-react';

type Section = 'general' | 'notifications' | 'security' | 'iot' | 'system';

const SECTIONS: { id: Section; label: string; icon: React.ReactNode; desc: string }[] = [
  { id: 'general',       label: 'ทั่วไป',           icon: <Settings className="w-4 h-4" />,  desc: 'ข้อมูลระบบและการแสดงผล' },
  { id: 'notifications', label: 'การแจ้งเตือน',      icon: <Bell className="w-4 h-4" />,     desc: 'ตั้งค่าการแจ้งเตือน' },
  { id: 'security',      label: 'ความปลอดภัย',       icon: <Shield className="w-4 h-4" />,   desc: 'RBAC และการเข้าถึง' },
  { id: 'iot',           label: 'IoT & MQTT',        icon: <Wifi className="w-4 h-4" />,     desc: 'การเชื่อมต่อ ESP32' },
  { id: 'system',        label: 'ระบบ',              icon: <Database className="w-4 h-4" />, desc: 'Firebase และ backup' },
];

const Toggle = ({ checked, onChange }: { checked: boolean; onChange: () => void }) => (
  <button
    onClick={onChange}
    className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-red-500' : 'bg-gray-700'}`}
  >
    <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
  </button>
);

const InputField = ({ label, value, type = 'text', hint }: { label: string; value: string; type?: string; hint?: string }) => (
  <div>
    <label className="block text-xs font-medium text-gray-400 mb-1.5">{label}</label>
    <input
      type={type}
      defaultValue={value}
      className="w-full px-3.5 py-2.5 bg-white/5 border border-gray-700/50 rounded-xl text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
    />
    {hint && <p className="text-[10px] text-gray-600 mt-1">{hint}</p>}
  </div>
);

type IoInputState = 'idle' | 'pressed' | 'wiring_suspected';
type IoTone = 'online' | 'warning' | 'offline' | 'neutral';

const DEVICE_OPTIONS = [
  { id: 'washer-a01', label: 'Washer A01', branch: 'BR-001 Rama 2' },
  { id: 'washer-a02', label: 'Washer A02', branch: 'BR-001 Rama 2' },
  { id: 'washer-b01', label: 'Washer B01', branch: 'BR-002 Bangna' },
] as const;

const INPUT_ROWS: Array<{
  key: string;
  label: string;
  pin: string;
  state: IoInputState;
  lastSeen: string;
}> = [
  { key: 'start', label: 'START button', pin: 'GPIO18', state: 'idle', lastSeen: '2 min ago' },
  { key: 'stop', label: 'STOP button', pin: 'GPIO19', state: 'pressed', lastSeen: 'just now' },
  { key: 'power', label: 'POWER / AUX', pin: 'GPIO21', state: 'wiring_suspected', lastSeen: 'no signal yet' },
];

const EVENT_LOG = [
  '10:42:11 START pressed from GPIO18',
  '10:42:12 MQTT command:start published',
  '10:42:13 machine status changed to washing',
  '10:54:48 STOP pressed from GPIO19',
  '10:54:48 operator input test passed',
];

function toneClasses(tone: IoTone) {
  switch (tone) {
    case 'online':
      return 'border-green-500/30 bg-green-500/10 text-green-300';
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/10 text-amber-300';
    case 'offline':
      return 'border-red-500/30 bg-red-500/10 text-red-300';
    default:
      return 'border-white/10 bg-white/[0.03] text-gray-300';
  }
}

function toneDot(tone: IoTone) {
  switch (tone) {
    case 'online':
      return 'bg-green-400';
    case 'warning':
      return 'bg-amber-400';
    case 'offline':
      return 'bg-red-400';
    default:
      return 'bg-gray-500';
  }
}

function InputStateBadge({ state }: { state: IoInputState }) {
  const config =
    state === 'pressed'
      ? { label: 'Pressed', classes: 'border-green-500/30 bg-green-500/10 text-green-300' }
      : state === 'wiring_suspected'
        ? { label: 'Wiring suspected', classes: 'border-amber-500/30 bg-amber-500/10 text-amber-300' }
        : { label: 'Idle', classes: 'border-white/10 bg-white/[0.03] text-gray-300' };

  return <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${config.classes}`}>{config.label}</span>;
}

export function SettingsPage() {
  const [section, setSection] = useState<Section>('general');
  const [saved, setSaved] = useState(false);
  const [notifMachine, setNotifMachine] = useState(true);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifLowRating, setNotifLowRating] = useState(true);
  const [notifDaily, setNotifDaily] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [autoLogout, setAutoLogout] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState<(typeof DEVICE_OPTIONS)[number]['id']>(DEVICE_OPTIONS[0].id);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6 max-w-[1100px]">
      <div>
        <h2 className="text-2xl font-bold text-white">ตั้งค่าระบบ</h2>
        <p className="text-gray-500 text-sm mt-0.5">จัดการการตั้งค่า ROBOSS Admin</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Nav */}
        <div className="space-y-1">
          {SECTIONS.map(s => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all text-left ${
                section === s.id
                  ? 'bg-red-500/15 text-red-400'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {s.icon}
              <div>
                <p>{s.label}</p>
                <p className="text-[10px] text-gray-600 font-normal">{s.desc}</p>
              </div>
              <ChevronRight className={`w-3.5 h-3.5 ml-auto ${section === s.id ? 'text-red-400' : 'text-gray-700'}`} />
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="gradient-card rounded-2xl p-6 space-y-6">
            {section === 'general' && (
              <>
                <h3 className="text-white font-semibold border-b border-gray-800/50 pb-4">ข้อมูลทั่วไป</h3>
                <div className="grid grid-cols-2 gap-4">
                  <InputField label="ชื่อระบบ" value="ROBOSS Car Wash" />
                  <InputField label="เวอร์ชัน" value="v1.0.0" />
                  <div className="col-span-2">
                    <InputField label="ที่อยู่สำนักงานใหญ่" value="123 ถนนสุขุมวิท กรุงเทพฯ 10110" />
                  </div>
                  <InputField label="อีเมลติดต่อ" value="admin@roboss.co.th" type="email" />
                  <InputField label="เบอร์โทรสนับสนุน" value="02-xxx-xxxx" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">Timezone</label>
                  <select className="w-full px-3.5 py-2.5 bg-white/5 border border-gray-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-red-500/50">
                    <option value="Asia/Bangkok">Asia/Bangkok (GMT+7)</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2">ภาษาเริ่มต้น</label>
                  <select className="w-full px-3.5 py-2.5 bg-white/5 border border-gray-700/50 rounded-xl text-sm text-white focus:outline-none focus:border-red-500/50">
                    <option value="th">ภาษาไทย</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </>
            )}

            {section === 'notifications' && (
              <>
                <h3 className="text-white font-semibold border-b border-gray-800/50 pb-4">การแจ้งเตือน</h3>
                <div className="space-y-4">
                  {[
                    { label: 'เครื่อง Offline / ขัดข้อง', desc: 'แจ้งเตือนทันทีเมื่อ ESP32 ไม่ตอบสนอง', value: notifMachine, onChange: () => setNotifMachine(!notifMachine) },
                    { label: 'การชำระเงินผิดพลาด', desc: 'แจ้งเตือนเมื่อ payment webhook ล้มเหลว', value: notifPayment, onChange: () => setNotifPayment(!notifPayment) },
                    { label: 'Rating ต่ำกว่า 3', desc: 'แจ้งเตือนเมื่อลูกค้าให้คะแนนต่ำ', value: notifLowRating, onChange: () => setNotifLowRating(!notifLowRating) },
                    { label: 'รายงานสรุปรายวัน', desc: 'ส่งรายงานรายได้สรุปทุกเช้า 08:00 น.', value: notifDaily, onChange: () => setNotifDaily(!notifDaily) },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-gray-700/30">
                      <div>
                        <p className="text-sm text-white font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle checked={item.value} onChange={item.onChange} />
                    </div>
                  ))}
                </div>
                <div className="space-y-4 pt-2">
                  <InputField label="LINE Notify Token (สำหรับแจ้งเตือน)" value="xxxxxxxxxxxxxxxxxxxx" type="password" hint="ใช้สำหรับส่งแจ้งเตือนไปยัง LINE Group" />
                  <InputField label="Slack Webhook URL (optional)" value="" hint="นำ webhook URL จาก Slack App มาวางที่นี่" />
                </div>
              </>
            )}

            {section === 'security' && (
              <>
                <h3 className="text-white font-semibold border-b border-gray-800/50 pb-4">ความปลอดภัย & การเข้าถึง</h3>
                <div className="space-y-4">
                  {[
                    { label: 'บังคับใช้ 2FA สำหรับ HQ Admin', desc: 'ต้องการ OTP เพิ่มเมื่อล็อกอิน', value: require2FA, onChange: () => setRequire2FA(!require2FA) },
                    { label: 'Auto Logout หลังไม่ใช้งาน 30 นาที', desc: 'ออกจากระบบอัตโนมัติเพื่อความปลอดภัย', value: autoLogout, onChange: () => setAutoLogout(!autoLogout) },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-4 bg-white/[0.02] rounded-xl border border-gray-700/30">
                      <div>
                        <p className="text-sm text-white font-medium">{item.label}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                      </div>
                      <Toggle checked={item.value} onChange={item.onChange} />
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
                  <div className="flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-400 font-medium">Admin Roles (RBAC)</p>
                      <p className="text-xs text-amber-400/60 mt-1">
                        การจัดการ Role ผู้ใช้ ต้องทำผ่าน Firebase Console &gt; Authentication หรือ Cloud Functions
                        เพื่อความปลอดภัย
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {section === 'iot' && (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-gray-800/50 pb-4">
                  <div>
                    <h3 className="text-white font-semibold">ESP / IoT Console</h3>
                    <p className="mt-1 text-sm text-gray-500">Mockup for field setup, switch diagnostics, and MQTT connectivity before the real API is wired in.</p>
                  </div>
                  <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-300">
                    Admin preview
                  </span>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-700/40 bg-white/[0.02] p-5">
                      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-[0.2em] text-gray-500">Device target</p>
                          <select
                            value={selectedDevice}
                            onChange={(event) => setSelectedDevice(event.target.value as (typeof DEVICE_OPTIONS)[number]['id'])}
                            className="min-w-[240px] rounded-xl border border-gray-700/50 bg-white/5 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-red-500/50"
                          >
                            {DEVICE_OPTIONS.map((device) => (
                              <option key={device.id} value={device.id}>
                                {device.label} - {device.branch}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs md:text-right">
                          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-3 py-2 text-green-300">
                            <p className="font-medium">ESP online</p>
                            <p className="mt-1 text-green-300/70">Last heartbeat 12s ago</p>
                          </div>
                          <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-blue-300">
                            <p className="font-medium">MQTT connected</p>
                            <p className="mt-1 text-blue-300/70">RSSI -58 dBm</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        { label: 'Device health', value: 'Healthy', meta: 'Firmware v1.0.3', tone: 'online' as const, icon: Activity },
                        { label: 'Input wiring', value: 'Needs check', meta: 'POWER pin has no activity', tone: 'warning' as const, icon: PlugZap },
                        { label: 'Outputs', value: 'Relay not installed', meta: 'Input-only mode', tone: 'neutral' as const, icon: Power },
                      ].map((card) => (
                        <div key={card.label} className={`rounded-2xl border p-4 ${toneClasses(card.tone)}`}>
                          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em]">
                            <card.icon className="h-4 w-4" />
                            {card.label}
                          </div>
                          <p className="mt-3 text-lg font-semibold">{card.value}</p>
                          <p className="mt-1 text-xs opacity-75">{card.meta}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-gray-700/40 bg-white/[0.02] p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-semibold text-white">Input status</h4>
                          <p className="mt-1 text-xs text-gray-500">Shows whether ESP sees the switch signal. A physically disconnected switch still needs a wiring test or a dedicated circuit to confirm.</p>
                        </div>
                        <button className="rounded-xl border border-gray-700/60 bg-white/5 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white">
                          Run input test
                        </button>
                      </div>

                      <div className="mt-4 space-y-3">
                        {INPUT_ROWS.map((row) => (
                          <div key={row.key} className="flex flex-col gap-3 rounded-xl border border-gray-700/30 bg-black/10 p-4 md:flex-row md:items-center md:justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-white">{row.label}</p>
                                <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-mono text-gray-400">{row.pin}</span>
                              </div>
                              <p className="mt-1 text-xs text-gray-500">Last activity: {row.lastSeen}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <InputStateBadge state={row.state} />
                              <button className="rounded-lg border border-gray-700/50 px-3 py-1.5 text-xs text-gray-300 transition-colors hover:border-red-500/40 hover:text-white">
                                Test
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                      <div className="rounded-2xl border border-gray-700/40 bg-white/[0.02] p-5">
                        <h4 className="text-sm font-semibold text-white">Wiring config</h4>
                        <div className="mt-4 space-y-3 text-sm text-gray-300">
                          {[
                            ['Start pin', 'GPIO18'],
                            ['Stop pin', 'GPIO19'],
                            ['Power pin', 'GPIO21'],
                            ['Input mode', 'INPUT_PULLUP'],
                            ['Active state', 'LOW'],
                            ['Heartbeat timeout', '60 seconds'],
                          ].map(([label, value]) => (
                            <div key={label} className="flex items-center justify-between rounded-xl border border-gray-700/30 bg-black/10 px-3 py-2.5">
                              <span className="text-gray-400">{label}</span>
                              <span className="font-mono text-xs text-white">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-gray-700/40 bg-white/[0.02] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <h4 className="text-sm font-semibold text-white">Command test</h4>
                            <p className="mt-1 text-xs text-gray-500">Confirms the message path between admin, backend, MQTT, and ESP before relay control is added.</p>
                          </div>
                          <RefreshCw className="h-4 w-4 text-gray-500" />
                        </div>
                        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {['Test START', 'Test STOP', 'Refresh I/O'].map((label) => (
                            <button
                              key={label}
                              className="rounded-xl border border-gray-700/50 bg-white/5 px-4 py-3 text-sm font-medium text-gray-200 transition-colors hover:border-red-500/40 hover:bg-red-500/10 hover:text-white"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
                          Relay is not installed, so this mode only confirms button inputs and command delivery. It does not drive a pump or motor.
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-700/40 bg-white/[0.02] p-5">
                      <h4 className="text-sm font-semibold text-white">Connection details</h4>
                      <div className="mt-4 grid gap-4">
                        <InputField label="MQTT Broker Host" value="mqtt.hivemq.com" hint="Use your production broker when ready." />
                        <div className="grid grid-cols-2 gap-4">
                          <InputField label="MQTT Port" value="8883" />
                          <InputField label="Topic Prefix" value="roboss" />
                        </div>
                        <InputField label="MQTT Username" value="roboss_admin" />
                        <InputField label="MQTT Password" value="****************" type="password" />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
                      <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-300">Topic structure</p>
                      <div className="mt-3 space-y-2 font-mono text-[11px] text-blue-100/90">
                        <p>roboss/{'{branchId}'}/{'{espDeviceId}'}/command</p>
                        <p>roboss/{'{branchId}'}/{'{espDeviceId}'}/status</p>
                        <p>roboss/{'{branchId}'}/{'{espDeviceId}'}/events</p>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-gray-700/40 bg-white/[0.02] p-5">
                      <h4 className="text-sm font-semibold text-white">Field event log</h4>
                      <div className="mt-4 space-y-2">
                        {EVENT_LOG.map((item, index) => (
                          <div key={item} className="flex items-start gap-3 rounded-xl border border-gray-700/30 bg-black/10 px-3 py-2.5">
                            <span className={`mt-1 h-2 w-2 rounded-full ${toneDot(index < 2 ? 'online' : index === 4 ? 'warning' : 'neutral')}`} />
                            <p className="text-xs text-gray-300">{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5">
                      <div className="flex gap-2">
                        <Cpu className="h-4 w-4 flex-shrink-0 text-amber-300" />
                        <div>
                          <p className="text-sm font-medium text-amber-200">What the admin can really know</p>
                          <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
                            <li>ESP online/offline from heartbeat</li>
                            <li>Whether START/STOP input changes reach the GPIO pins</li>
                            <li>Whether a switch is physically disconnected only after a wiring test or extra detection hardware</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {section === 'system' && (
              <>
                <h3 className="text-white font-semibold border-b border-gray-800/50 pb-4">ระบบ & Firebase</h3>
                <div className="grid gap-4">
                  <InputField label="Firebase Project ID" value="roboss-app-prod" />
                  <InputField label="Firebase Region" value="asia-southeast1" hint="ใช้สำหรับ Cloud Functions" />
                  <InputField label="PromptPay Verification Endpoint" value="https://asia-southeast1-roboss-app-prod.cloudfunctions.net/verifyPayment" hint="Cloud Function endpoint สำหรับยืนยันการชำระเงิน" />
                </div>
                <div className="space-y-3 pt-2">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">สถานะระบบ</p>
                  {[
                    { label: 'Firebase Firestore', status: 'operational' },
                    { label: 'Firebase Auth', status: 'operational' },
                    { label: 'Cloud Functions', status: 'operational' },
                    { label: 'MQTT Broker', status: 'degraded' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-3 bg-white/[0.02] rounded-xl border border-gray-700/30">
                      <span className="text-sm text-gray-300">{item.label}</span>
                      <span className={`flex items-center gap-1.5 text-xs font-medium ${
                        item.status === 'operational' ? 'text-green-400' : 'text-amber-400'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          item.status === 'operational' ? 'bg-green-400' : 'bg-amber-400 animate-pulse'
                        }`} />
                        {item.status === 'operational' ? 'ปกติ' : 'ช้า'}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-800/50">
              {saved && (
                <span className="flex items-center gap-1.5 text-green-400 text-sm animate-fade-in">
                  <CheckCircle2 className="w-4 h-4" /> บันทึกแล้ว
                </span>
              )}
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
              >
                <Save className="w-4 h-4" /> บันทึก
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
