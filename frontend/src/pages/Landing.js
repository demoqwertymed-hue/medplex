/* src/pages/Landing.js */
import React from 'react';
import { Link } from 'react-router-dom';

export default function Landing(){
  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-2">Medical Device Risk Assessment</h2>
          <p className="text-gray-600 mb-4">Assess medical device risks for hospitals and improve manufacturing quality.</p>
          <div className="flex space-x-3">
            <Link to="/login" className="bg-brand-blue text-white px-4 py-2 rounded">Login</Link>
            <Link to="/register" className="bg-brand-green text-white px-4 py-2 rounded">Register</Link>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-xl font-semibold mb-2">Application Highlights</h3>
          <ul className="list-disc pl-5 text-gray-700 space-y-1">
            <li>Device Risk Checker</li>
            <li>Manufacturer Insights</li>
            <li>Fault Reduction</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
