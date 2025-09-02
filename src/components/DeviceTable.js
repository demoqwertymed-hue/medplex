/* src/components/DeviceTable.js */
import React from 'react';

export default function DeviceTable({ items }){
  return (
    <div className="overflow-x-auto bg-white rounded shadow-md">
      <table className="table-auto w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left">Device Name</th>
            <th className="px-4 py-2 text-left">Manufacturer</th>
            <th className="px-4 py-2 text-left">Risk Class</th>
            <th className="px-4 py-2 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {(items || []).map((d) => (
            <tr key={d._id} className="hover:bg-gray-100">
              <td className="px-4 py-2">{d.device_name}</td>
              <td className="px-4 py-2">{d.manufacturer_name}</td>
              <td className="px-4 py-2">{d.risk_class}</td>
              <td className="px-4 py-2">{new Date(d.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
