import React, { useEffect, useMemo, useState, useRef, Component } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  MapPin,
  Navigation,
  Clock,
  Car,
  Sparkles,
  Wind,
  Info,
  CheckCircle2,
  XCircle } from
'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
// --- Mock Data & Helpers ---
const USER_LOCATION: [number, number] = [13.7563, 100.5018]; // Bangkok center
interface Branch {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  isOpen: boolean;
  hours: string;
  services: ('wash' | 'coating' | 'vacuum')[];
}
const MOCK_BRANCHES: Branch[] = [
{
  id: '1',
  name: 'ROBOSS สาขาลาดพร้าว',
  address: '123 ซอยลาดพร้าว 101, วังทองหลาง, กรุงเทพฯ',
  lat: 13.785,
  lng: 100.628,
  isOpen: true,
  hours: '08:00 - 22:00',
  services: ['wash', 'coating', 'vacuum']
},
{
  id: '2',
  name: 'ROBOSS สาขาสุขุมวิท 71',
  address: '456 ซอยปรีดี พนมยงค์, วัฒนา, กรุงเทพฯ',
  lat: 13.733,
  lng: 100.596,
  isOpen: true,
  hours: '06:00 - 24:00',
  services: ['wash', 'vacuum']
},
{
  id: '3',
  name: 'ROBOSS สาขารัชดาภิเษก',
  address: '789 ถนนรัชดาภิเษก, ดินแดง, กรุงเทพฯ',
  lat: 13.775,
  lng: 100.574,
  isOpen: false,
  hours: '09:00 - 20:00',
  services: ['wash', 'coating']
},
{
  id: '4',
  name: 'ROBOSS สาขาบางนา',
  address: '101 ถนนบางนา-ตราด, บางนา, กรุงเทพฯ',
  lat: 13.668,
  lng: 100.614,
  isOpen: true,
  hours: '24 ชั่วโมง',
  services: ['wash', 'coating', 'vacuum']
},
{
  id: '5',
  name: 'ROBOSS สาขาสาทร',
  address: '22 ถนนสาทรใต้, ยานนาวา, กรุงเทพฯ',
  lat: 13.718,
  lng: 100.525,
  isOpen: true,
  hours: '07:00 - 23:00',
  services: ['wash']
},
{
  id: '6',
  name: 'ROBOSS สาขาปิ่นเกล้า',
  address: '333 ถนนบรมราชชนนี, บางกอกน้อย, กรุงเทพฯ',
  lat: 13.778,
  lng: 100.476,
  isOpen: false,
  hours: '08:00 - 21:00',
  services: ['wash', 'vacuum']
},
{
  id: '7',
  name: 'ROBOSS สาขาพหลโยธิน',
  address: '555 ถนนพหลโยธิน, จตุจักร, กรุงเทพฯ',
  lat: 13.828,
  lng: 100.569,
  isOpen: true,
  hours: '06:00 - 22:00',
  services: ['wash', 'coating', 'vacuum']
}];

// Haversine formula to calculate distance in km
function calculateDistance(
lat1: number,
lon1: number,
lat2: number,
lon2: number)
: number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
  Math.sin(dLat / 2) * Math.sin(dLat / 2) +
  Math.cos(deg2rad(lat1)) *
  Math.cos(deg2rad(lat2)) *
  Math.sin(dLon / 2) *
  Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
// Custom Map Icons
const userIcon = new L.DivIcon({
  className: 'custom-div-icon',
  html: `
    <div class="relative flex items-center justify-center w-6 h-6">
      <div class="absolute w-full h-full bg-blue-500 rounded-full opacity-50 animate-ping"></div>
      <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md"></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});
const createBranchIcon = (isSelected: boolean) =>
new L.DivIcon({
  className: 'custom-div-icon',
  html: `
    <div class="relative flex flex-col items-center justify-center transform transition-transform duration-300 ${isSelected ? 'scale-125 z-50' : 'scale-100 z-10'}">
      <div class="w-8 h-8 bg-app-red rounded-full flex items-center justify-center shadow-lg border-2 ${isSelected ? 'border-white' : 'border-app-black'}">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>
      </div>
      <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${isSelected ? 'border-t-white' : 'border-t-app-red'} -mt-1"></div>
    </div>
  `,
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});
// Component to handle map centering
function MapController({
  center,
  zoom



}: {center: [number, number];zoom: number;}) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, {
      animate: true,
      duration: 0.5
    });
  }, [center, zoom, map]);
  return null;
}
interface NearbyBranchesProps {
  onBack: () => void;
}
export function NearbyBranches({ onBack }: NearbyBranchesProps) {
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>(USER_LOCATION);
  const [mapZoom, setMapZoom] = useState(12);
  const listRef = useRef<HTMLDivElement>(null);
  // Calculate distances and sort branches
  const branchesWithDistance = useMemo(() => {
    return MOCK_BRANCHES.map((branch) => ({
      ...branch,
      distance: calculateDistance(
        USER_LOCATION[0],
        USER_LOCATION[1],
        branch.lat,
        branch.lng
      )
    })).sort((a, b) => a.distance - b.distance);
  }, []);
  const handleBranchSelect = (
  branch: Branch & {
    distance: number;
  }) =>
  {
    setSelectedBranchId(branch.id);
    setMapCenter([branch.lat, branch.lng]);
    setMapZoom(15);
    // Scroll list to top if needed, or just let it be
  };
  const renderHeader = () =>
  <div className="flex items-center justify-between px-4 py-4 border-b border-app-dark bg-app-black/95 sticky top-0 z-50">
      <button
      onClick={onBack}
      className="p-2 -ml-2 text-white hover:bg-white/10 rounded-full transition-colors">
      
        <ChevronLeft size={24} />
      </button>
      <h1 className="text-white font-bold text-lg">สาขาใกล้คุณ</h1>
      <div className="w-10" /> {/* Spacer for centering */}
    </div>;

  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'wash':
        return <Car size={14} />;
      case 'coating':
        return <Sparkles size={14} />;
      case 'vacuum':
        return <Wind size={14} />;
      default:
        return null;
    }
  };
  const getServiceName = (service: string) => {
    switch (service) {
      case 'wash':
        return 'ล้างรถ';
      case 'coating':
        return 'เคลือบแก้ว';
      case 'vacuum':
        return 'ดูดฝุ่น';
      default:
        return '';
    }
  };
  return (
    <div className="flex-1 flex flex-col bg-app-black overflow-hidden relative h-full">
      {renderHeader()}

      {/* Map Section (Top ~45%) */}
      <div className="relative h-[45%] w-full z-0 bg-gray-900">
        <MapContainer
          center={mapCenter}
          zoom={mapZoom}
          style={{
            height: '100%',
            width: '100%'
          }}
          zoomControl={false}
          attributionControl={false}>
          
          {/* Using CartoDB Dark Matter tiles for a dark theme map */}
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />

          <MapController center={mapCenter} zoom={mapZoom} />

          {/* User Location Marker */}
          <Marker position={USER_LOCATION} icon={userIcon} />

          {/* Branch Markers */}
          {branchesWithDistance.map((branch) =>
          <Marker
            key={branch.id}
            position={[branch.lat, branch.lng]}
            icon={createBranchIcon(selectedBranchId === branch.id)}
            eventHandlers={{
              click: () => handleBranchSelect(branch)
            }} />

          )}
        </MapContainer>

        {/* Map Overlay Gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-app-black to-transparent z-[400] pointer-events-none" />
      </div>

      {/* Bottom Sheet List (Bottom ~55%) */}
      <div className="flex-1 bg-app-black rounded-t-3xl -mt-6 z-10 relative flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10">
        {/* Drag Handle Indicator */}
        <div className="w-full flex justify-center pt-3 pb-2">
          <div className="w-12 h-1.5 bg-gray-700 rounded-full" />
        </div>

        {/* List Header */}
        <div className="px-5 pb-3 pt-1 border-b border-white/5 flex justify-between items-center">
          <h2 className="text-white font-bold text-lg">
            สาขาทั้งหมด{' '}
            <span className="text-gray-400 font-normal text-sm">
              ({branchesWithDistance.length} สาขา)
            </span>
          </h2>
          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-md">
            เรียงตามระยะทาง
          </span>
        </div>

        {/* Scrollable List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-4">
          
          <AnimatePresence>
            {branchesWithDistance.map((branch, index) => {
              const isSelected = selectedBranchId === branch.id;
              return (
                <motion.div
                  key={branch.id}
                  initial={{
                    opacity: 0,
                    y: 20
                  }}
                  animate={{
                    opacity: 1,
                    y: 0
                  }}
                  transition={{
                    delay: index * 0.05,
                    duration: 0.3
                  }}
                  onClick={() => handleBranchSelect(branch)}
                  className={`
                    relative p-4 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden
                    ${isSelected ? 'bg-app-red/5 border-app-red shadow-[0_0_15px_rgba(220,38,38,0.15)]' : 'bg-app-dark border-white/5 hover:border-white/10'}
                  `}>
                  
                  {/* Selected Accent Line */}
                  {isSelected &&
                  <motion.div
                    layoutId="selectedAccent"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-app-red" />

                  }

                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 pr-2">
                      <h3
                        className={`font-bold text-base mb-1 transition-colors ${isSelected ? 'text-app-red' : 'text-white'}`}>
                        
                        {branch.name}
                      </h3>
                      <p className="text-xs text-gray-400 line-clamp-1 flex items-center gap-1">
                        <MapPin size={12} className="shrink-0" />
                        {branch.address}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-lg font-black text-white">
                        {branch.distance.toFixed(1)}{' '}
                        <span className="text-xs font-normal text-gray-400">
                          กม.
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4 mt-3">
                    <div
                      className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md ${branch.isOpen ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                      
                      {branch.isOpen ?
                      <CheckCircle2 size={12} /> :

                      <XCircle size={12} />
                      }
                      {branch.isOpen ? 'เปิดให้บริการ' : 'ปิดให้บริการ'}
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                      <Clock size={12} />
                      {branch.hours}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-4">
                    {branch.services.map((service) =>
                    <div
                      key={service}
                      className="flex items-center gap-1 text-[10px] bg-white/5 text-gray-300 px-2 py-1 rounded-full border border-white/5">
                      
                        {getServiceIcon(service)}
                        <span>{getServiceName(service)}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
                    <button
                      className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle details action
                      }}>
                      
                      <Info size={16} />
                      ดูรายละเอียด
                    </button>
                    <button
                      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-bold transition-colors shadow-lg
                        ${isSelected ? 'bg-app-red hover:bg-red-600 shadow-red-900/30' : 'bg-app-dark border border-app-red text-app-red hover:bg-app-red/10'}
                      `}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Handle navigation action
                      }}>
                      
                      <Navigation
                        size={16}
                        className={isSelected ? 'text-white' : 'text-app-red'} />
                      
                      นำทาง
                    </button>
                  </div>
                </motion.div>);

            })}
          </AnimatePresence>

          {/* Bottom padding */}
          <div className="h-6" />
        </div>
      </div>
    </div>);

}