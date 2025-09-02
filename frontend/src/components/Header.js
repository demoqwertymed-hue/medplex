/* src/components/Header.js */
import React from 'react';
import { Link } from 'react-router-dom';

export default function Header({ onLogout }){
  return (
    <header className="bg-white shadow">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-2">
          <div className="bg-brand-blue text-white font-bold w-8 h-8 rounded flex items-center justify-center">MD</div>
          <div>
            <h1 className="text-lg font-semibold">Medical Device Risk Assessment</h1>
            <p className="text-xs text-gray-500">Assess risks. Improve quality.</p>
          </div>
        </Link>
        <nav className="flex items-center space-x-4">
          <Link className="text-sm hover:text-brand-blue" to="/">Home</Link>
          <Link className="text-sm hover:text-brand-blue" to="/medical-dashboard">Medical Dashboard</Link>
          <Link className="text-sm hover:text-brand-blue" to="/device-risk-checker">Risk Checker</Link>
          {onLogout && (
            <button className="text-sm text-white bg-brand-blue px-3 py-1 rounded" onClick={onLogout}>Logout</button>
          )}
        </nav>
      </div>
    </header>
  );
}
