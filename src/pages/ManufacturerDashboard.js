/* src/pages/ManufacturerDashboard.js */
import React, { useEffect, useMemo, useState } from 'react';
import DeviceTable from '../components/DeviceTable.js';
import { BarChart } from '../components/RiskChart.js';

export default function ManufacturerDashboard({ backend, user }){
  const [items, setItems] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await backend.devices();
        const filtered = data.filter(d => d.manufacturer_name?.toLowerCase() === (user?.company_name || user?.username || '').toLowerCase());
        setItems(filtered);
      } catch {
        setItems([]);
      }
    })();
  }, [backend, user]);

  const counts = useMemo(() => {
    const c = { low: 0, medium: 0, high: 0 };
    for (const d of items) {
      if (d.risk_class === 'Low') c.low++;
      else if (d.risk_class === 'Medium') c.medium++;
      else if (d.risk_class === 'High') c.high++;
    }
    return c;
  }, [items]);

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-white rounded shadow p-6 mb-6">
        <h2 className="text-xl font-semibold">Welcome, {user?.company_name || user?.username || 'Manufacturer'}</h2>
        <p className="text-gray-600 mt-2">Insights into device risk distribution and feedback.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Device Risk Distribution</h3>
          <BarChart counts={counts} />
        </div>
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Your Devices</h3>
          <DeviceTable items={items} />
        </div>
      </div>
    </main>
  );
}
