import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Branch } from '@/types';

export interface BranchInfo {
  id: string;
  name: string;
  shortName: string;
  address: string;
  type: 'car' | 'bike';
  isOpen: boolean;
  hours: string;
  mapsUrl?: string;
  lat?: number;
  lng?: number;
  promptPayId?: string;
  promptPayName?: string;
}

// Static fallback when backend is unreachable
const FALLBACK_BRANCHES: BranchInfo[] = [
  { id: 'branch_c01', name: 'ROBOSS รามอินทรา 109', shortName: 'รามอินทรา 109', address: '99/9 ถ.รามอินทรา กม.9 คันนายาว กรุงเทพฯ', type: 'car', isOpen: true, hours: '06:00 - 22:00', mapsUrl: 'https://maps.app.goo.gl/ut1MVhuveKSvmiS27', lat: 13.8682, lng: 100.6378 },
  { id: 'branch_c02', name: 'ROBOSS พระราม 9', shortName: 'พระราม 9', address: '1 ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ', type: 'car', isOpen: true, hours: '06:00 - 22:00', mapsUrl: 'https://maps.app.goo.gl/vAZEwXHVvJkPc7yJ7', lat: 13.7489, lng: 100.5714 },
  { id: 'branch_c03', name: 'ROBOSS ท่าพระ', shortName: 'ท่าพระ', address: '8/1 ถ.ท่าพระ ธนบุรี กรุงเทพฯ', type: 'car', isOpen: true, hours: '06:00 - 22:00', mapsUrl: 'https://maps.app.goo.gl/SC7SsTxuR1bpcpnq9', lat: 13.726, lng: 100.4785 },
  { id: 'branch_c04', name: 'ROBOSS ชลบุรี', shortName: 'ชลบุรี', address: '99 ถ.สุขุมวิท เมืองชลบุรี', type: 'car', isOpen: true, hours: '07:00 - 21:00', mapsUrl: 'https://maps.app.goo.gl/H1xqWbL8BETheHpc6', lat: 13.3611, lng: 100.9847 },
  { id: 'branch_c05', name: 'ROBOSS สตูล', shortName: 'สตูล', address: '15 ถ.สตูลธานี เมืองสตูล', type: 'car', isOpen: true, hours: '07:00 - 20:00', mapsUrl: 'https://maps.app.goo.gl/tQLW2vdJ1bHygoBF7', lat: 6.6238, lng: 100.0674 },
  { id: 'branch_c06', name: 'ROBOSS นครศรีธรรมราช', shortName: 'นครศรีฯ', address: '55 ถ.ราชดำเนิน เมืองนครศรีธรรมราช', type: 'car', isOpen: true, hours: '07:00 - 21:00', mapsUrl: 'https://maps.app.goo.gl/qdMDCMGr6LfagE2N8', lat: 8.4327, lng: 99.9638 },
  { id: 'branch_c07', name: 'ROBOSS อุทัยธานี', shortName: 'อุทัยธานี', address: '123 ถ.ศรีอุทัย เมืองอุทัยธานี', type: 'car', isOpen: true, hours: '07:00 - 20:00', mapsUrl: 'https://maps.app.goo.gl/8dn8U7UiKFwY3dST7', lat: 15.3833, lng: 100.0247 },
  { id: 'branch_b01', name: 'ROBOSS มอไซค์ พระราม 9', shortName: 'มอไซค์ พระราม 9', address: '1/2 ถ.พระราม 9 ห้วยขวาง กรุงเทพฯ', type: 'bike', isOpen: true, hours: '06:00 - 22:00', mapsUrl: 'https://maps.app.goo.gl/vAZEwXHVvJkPc7yJ7', lat: 13.7485, lng: 100.5720 },
  { id: 'branch_b02', name: 'ROBOSS มอไซค์ พระราม 4', shortName: 'มอไซค์ พระราม 4', address: '10 ถ.พระราม 4 คลองเตย กรุงเทพฯ', type: 'bike', isOpen: true, hours: '06:00 - 22:00', mapsUrl: 'https://maps.app.goo.gl/WhtiRPuwrRzrwgHF7', lat: 13.7220, lng: 100.5530 },
  { id: 'branch_b03', name: 'ROBOSS มอไซค์ ท่าพระ', shortName: 'มอไซค์ ท่าพระ', address: '8/2 ถ.ท่าพระ ธนบุรี กรุงเทพฯ', type: 'bike', isOpen: true, hours: '06:00 - 22:00', mapsUrl: 'https://maps.app.goo.gl/F5GfLG99U1SDzy28A', lat: 13.7265, lng: 100.4790 },
  { id: 'branch_b04', name: 'ROBOSS มอไซค์ ชลบุรี', shortName: 'มอไซค์ ชลบุรี', address: '100 ถ.สุขุมวิท เมืองชลบุรี', type: 'bike', isOpen: true, hours: '07:00 - 21:00', mapsUrl: 'https://maps.app.goo.gl/6FdX7LG31ozszmc29', lat: 13.3615, lng: 100.9850 },
  { id: 'branch_b05', name: 'ROBOSS มอไซค์ ภูเก็ต', shortName: 'มอไซค์ ภูเก็ต', address: '22 ถ.ทวีวงศ์ ป่าตอง ภูเก็ต', type: 'bike', isOpen: true, hours: '07:00 - 21:00', mapsUrl: 'https://maps.app.goo.gl/oazz3WiRR5ghx8SAA', lat: 7.8900, lng: 98.2950 },
  { id: 'branch_b06', name: 'ROBOSS มอไซค์ แม่สอด', shortName: 'มอไซค์ แม่สอด', address: '33 ถ.ประสาทวิถี แม่สอด ตาก', type: 'bike', isOpen: true, hours: '07:00 - 20:00', mapsUrl: 'https://maps.app.goo.gl/BbHegYXa99rbBCGC9', lat: 16.7130, lng: 98.5730 },
];

function apiBranchToBranchInfo(b: Branch): BranchInfo {
  return {
    id: b.id,
    name: b.name,
    shortName: b.shortName || b.name.replace('ROBOSS ', ''),
    address: b.address,
    type: b.type === 'bike' ? 'bike' : 'car',
    isOpen: b.isActive,
    hours: b.hours || '06:00 - 22:00',
    mapsUrl: b.mapsUrl,
    lat: b.location?.lat,
    lng: b.location?.lng,
    promptPayId: b.promptPayId,
    promptPayName: b.promptPayName,
  };
}

const STORAGE_KEY = 'roboss_selected_branch';

interface BranchContextType {
  branch: BranchInfo;
  allBranches: BranchInfo[];
  setBranch: (b: BranchInfo) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextType>({
  branch: FALLBACK_BRANCHES[0],
  allBranches: FALLBACK_BRANCHES,
  setBranch: () => {},
  isLoading: false,
});

export function BranchProvider({ children }: { children: ReactNode }) {
  const [allBranches, setAllBranches] = useState<BranchInfo[]>(FALLBACK_BRANCHES);
  const [isLoading, setIsLoading] = useState(false);

  const [branch, setBranchState] = useState<BranchInfo>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const found = FALLBACK_BRANCHES.find(b => b.id === saved);
      if (found) return found;
    }
    return FALLBACK_BRANCHES[0];
  });

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    if (!apiUrl) return;

    setIsLoading(true);
    fetch(`${apiUrl}/branches`)
      .then(res => res.json())
      .then(json => {
        if (json.data && Array.isArray(json.data)) {
          const mapped = json.data.map(apiBranchToBranchInfo);
          if (mapped.length > 0) {
            setAllBranches(mapped);
            const savedId = localStorage.getItem(STORAGE_KEY);
            const found = mapped.find((b: BranchInfo) => b.id === savedId);
            setBranchState(found || mapped[0]);
          }
        }
      })
      .catch(() => {
        // Backend not reachable — keep fallback
      })
      .finally(() => setIsLoading(false));
  }, []);

  const setBranch = (b: BranchInfo) => {
    setBranchState(b);
    localStorage.setItem(STORAGE_KEY, b.id);
  };

  return (
    <BranchContext.Provider value={{ branch, allBranches, setBranch, isLoading }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}

export { FALLBACK_BRANCHES as ALL_BRANCHES };
