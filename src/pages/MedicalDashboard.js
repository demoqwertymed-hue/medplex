/* src/pages/MedicalDashboard.js */
import React, { useEffect, useState } from 'react';
import DeviceTable from '../components/DeviceTable.js';

export default function MedicalDashboard({ backend, user }){
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded shadow p-6">
          <h2 className="text-xl font-semibold">Welcome, {user?.username || 'User'}</h2>
          <p className="text-gray-600 mt-2">Quickly check device risks and review recent activity.</p>
          <a href="#/device-risk-checker" className="inline-block mt-4 bg-brand-blue text-white px-4 py-2 rounded">Go to Risk Checker</a>
        </div>
        <div className="bg-white rounded shadow p-6">
          <h3 className="text-lg font-semibold mb-3">Recent Activity</h3>
          <DeviceTable items={items} />
        </div>
      </div>
    </main>
  );
}
