import React from 'react';
const services = [
{
  id: 1,
  name: 'ล้างรถภายนอก',
  price: '99 บาท',
  img: 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?auto=format&fit=crop&w=200&h=200'
},
{
  id: 2,
  name: 'ล้าง + ดูดฝุ่น',
  price: '199 บาท',
  img: 'https://images.unsplash.com/photo-1607860108855-64acf2078ed9?auto=format&fit=crop&w=200&h=200'
},
{
  id: 3,
  name: 'เคลือบแก้ว',
  price: '599 บาท',
  img: 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?auto=format&fit=crop&w=200&h=200'
},
{
  id: 4,
  name: 'แพ็กเกจ VIP',
  price: '999 บาท',
  img: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=200&h=200'
}];

export function ProductCategories() {
  return (
    <div className="py-2">
      <div className="px-4 mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="w-1.5 h-5 bg-app-red rounded-full inline-block"></span>
          บริการของเรา
        </h2>
        <button className="text-xs text-app-red hover:text-red-400 font-medium">
          ดูทั้งหมด
        </button>
      </div>

      <div className="flex overflow-x-auto gap-3 px-4 pb-6 snap-x no-scrollbar">
        {services.map((service) =>
        <div
          key={service.id}
          className="snap-start shrink-0 w-32 group cursor-pointer">
          
            <div className="w-32 h-28 rounded-2xl bg-app-dark border border-app-dark overflow-hidden mb-2 relative group-hover:border-app-red/50 transition-colors">
              <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors z-10"></div>
              <img
              src={service.img}
              alt={service.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
            
            </div>
            <p className="text-xs text-center text-gray-300 group-hover:text-white transition-colors font-medium">
              {service.name}
            </p>
            <p className="text-xs text-center text-app-red font-bold mt-0.5">
              {service.price}
            </p>
          </div>
        )}
      </div>
    </div>);

}