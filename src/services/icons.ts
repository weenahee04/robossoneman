// Icons8 iOS 17 Outlined icons — monochrome white/gray theme
// All icons from Icons8 MCP server, platform: ios7 (iOS 17 Outlined)

// Icon ID mapping (ios7 platform — monochrome outlined)
const iconIds = {
  // Navigation
  back: 1806,        // Back chevron
  home: 73,          // Home

  // Scan & QR
  qrCode: 7911,      // QR Code
  
  // Wash steps
  water: 1946,        // Water droplet
  soap: 8243,         // Soap bubble
  refresh: 11675,     // Refresh/rotate
  wind: 31842,        // Wind
  shine: 38532,       // Metallic paint/shine
  
  // Status
  checkmark: 11695,   // Checkmark circle
  
  // UI elements
  star: 39070,        // Star
  starFilled: 39070,  // Star filled (rating)
  mapPin: 41445,      // Map pin (location)
  timer: 1112,        // Timer/clock
  share: 3447,        // Share
  copy: 30,           // Copy/clipboard
  lightning: 6703,    // Lightning bolt (points/zap)
  receipt: 4720,      // Receipt
  carService: 24548,  // Car service
  sedan: 16553,       // Sedan (small car)
  car: 12666,         // Car (medium)
  suv: 16551,         // SUV (large)
  gift: 7694,         // Gift
  trending: 26028,    // Trending up
  lock: 15094,        // Lock
  tag: 2983,          // Tag/label

  // New — Profile & Settings
  user: 7345,         // User/person
  settings: 15117,    // Settings gear
  bell: 9041,         // Bell/notification
  history: 2294,      // Clock history
  shop: 9218,         // Shopping bag
  chat: 12002,        // Chat/message
  people: 7348,       // People/group
  question: 11715,    // Question mark circle
  edit: 49,          // Edit/pencil
  phone: 687,         // Phone
  mail: 12549,        // Email
  logout: 12555,      // Logout/exit
  camera: 7808,       // Camera
  trash: 12259,       // Delete/trash
  search: 131,        // Search/magnifier
  filter: 15086,      // Filter
  link: 3471,         // Link
  info: 11716,        // Info circle
  shield: 15118,      // Shield/security
  globe: 5524,        // Globe/language
} as const;

type IconName = keyof typeof iconIds;

const iconSvgPaths: Record<IconName, string> = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  qrCode: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z"/><path d="M14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z"/>',
  water: '<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11z"/>',
  soap: '<circle cx="9" cy="15" r="4"/><circle cx="15.5" cy="8.5" r="2.5"/><circle cx="17" cy="16.5" r="2"/>',
  refresh: '<path d="M20 6v5h-5"/><path d="M4 18v-5h5"/><path d="M19 11A7 7 0 0 0 7.8 5.4L4 9"/><path d="M5 13a7 7 0 0 0 11.2 5.6L20 15"/>',
  wind: '<path d="M4 8h10a3 3 0 1 0-3-3"/><path d="M4 13h14a3 3 0 1 1-3 3"/><path d="M4 18h7"/>',
  shine: '<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z"/><path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z"/>',
  checkmark: '<path d="M20 6 9 17l-5-5"/><circle cx="12" cy="12" r="9"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9z"/>',
  starFilled: '<path fill="#000" stroke="none" d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.2 6.4 20.2 7.5 14 3 9.6l6.2-.9z"/>',
  mapPin: '<path d="M12 21s7-5.3 7-11a7 7 0 0 0-14 0c0 5.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 13V8M12 2h4M9 2h6"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.7 10.7 6.6-4.4M8.7 13.3l6.6 4.4"/>',
  copy: '<path d="M8 8h10v12H8z"/><path d="M6 16H4V4h12v2"/>',
  lightning: '<path fill="#000" stroke="none" d="M13 2 4 14h7l-1 8 10-13h-7z"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
  carService: '<path d="M4 14h16l-2-5H6z"/><path d="M6 14v4M18 14v4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M9 5h6M12 2v6"/>',
  sedan: '<path d="M3 14h18l-2.5-5h-13z"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
  car: '<path d="M4 15h16l-2-5H6z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/><path d="M6 10l2-4h8l2 4"/>',
  suv: '<path d="M3 15h18l-1.5-6H5z"/><path d="M7 9V5h8l3 4"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  gift: '<path d="M4 10h16v11H4z"/><path d="M3 6h18v4H3zM12 6v15"/><path d="M12 6c-2-4-6-3-5 0M12 6c2-4 6-3 5 0"/>',
  trending: '<path d="M4 16 9 11l4 4 7-8"/><path d="M15 7h5v5"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  tag: '<path d="M20 12 12 20 4 12V4h8z"/><circle cx="9" cy="9" r="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  settings: '<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/><path d="M4 12h2M18 12h2M12 4v2M12 18v2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
  history: '<path d="M4 4v6h6"/><path d="M5 10a7 7 0 1 0 2-5"/><path d="M12 8v5l3 2"/>',
  shop: '<path d="M6 8h12l-1 13H7z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  people: '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0"/><path d="M17 11a3 3 0 0 0 0-6M17 14a5 5 0 0 1 5 5"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.5 2.5 0 1 1 4.4 1.7c-1.2 1-2.2 1.5-2.2 3.3M12 18h.01"/>',
  edit: '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="m14 6 4 4"/>',
  phone: '<path d="M6 4h4l2 5-3 2a12 12 0 0 0 4 4l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
  mail: '<path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/>',
  logout: '<path d="M10 4H5v16h5"/><path d="M14 8l4 4-4 4"/><path d="M8 12h10"/>',
  camera: '<path d="M4 8h4l2-3h4l2 3h4v11H4z"/><circle cx="12" cy="14" r="4"/>',
  trash: '<path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 14h10l1-14"/><path d="M9 7V4h6v3"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1 1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1-1"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v6M12 7h.01"/>',
  shield: '<path d="M12 3 20 6v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
};

export function getIconUrl(name: IconName, size = 32): string {
  const body = iconSvgPaths[name];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function getAvailableIcons(): IconName[] {
  return Object.keys(iconIds) as IconName[];
}

export const ICONS8_ATTRIBUTION = 'Icons by Icons8';

export type { IconName };
export { iconIds };
