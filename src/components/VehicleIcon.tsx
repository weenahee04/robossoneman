import React from 'react';
import { CarFront } from 'lucide-react';
import { getIconUrl } from '../services/icons';

/** Plain outline vehicle glyph; keep motorcycles distinct from bicycles. */
export function VehicleIcon({ motorcycle = false, size = 22 }: { motorcycle?: boolean; size?: number }) {
  return motorcycle
    ? <img src={getIconUrl('motorcycle', size * 2)} width={size} height={size} alt="" className="pitlane-vehicle-icon" />
    : <CarFront size={size} strokeWidth={2} aria-hidden="true" />;
}
