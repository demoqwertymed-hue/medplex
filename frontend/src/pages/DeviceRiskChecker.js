/* src/pages/DeviceRiskChecker.js */
import React, { useEffect, useState } from 'react';
import DeviceTable from '../components/DeviceTable.js';

export default function DeviceRiskChecker({ backend }){
  const [manufacturer, setManufacturer] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await backend.devices();
        setItems(data);
      } catch {
        setItems([]);
      }
    })();
  }, [backend]);

  async function submit(){
    try {
      const { data } = await backend.predict({ device_name: deviceName, manufacturer_name: manufacturer });
      localStorage.setItem('lastPrediction', JSON.stringify(data));
      window.location.hash = '#/risk-result';
    } catch {
      window.toast?.error?.('Prediction failed');
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Device Risk Checker</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Manufacturer Name</label>
            <input className="w-full border rounded px-3 py-2" placeholder="e.g., MediTech" value={manufacturer} onChange={(e)=>setManufacturer(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Device Name</label>
            <input className="w-full border rounded px-3 py-2" placeholder="e.g., CardioMon 3000" value={deviceName} onChange={(e)=>setDeviceName(e.target.value)} />
          </div>
          <div className="flex items-end">
            <button onClick={submit} className="bg-brand-green text-white px-4 py-2 rounded w-full">Assess Risk</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded shadow p-6">
        <h3 className="text-lg font-semibold mb-3">Recent Risk Checks</h3>
        <DeviceTable items={items} />
      </div>
    </main>
  );
}
