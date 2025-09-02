/* src/pages/Register.js */
import React, { useState } from 'react';

export default function Register({ backend }){
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Medical');
  const [company, setCompany] = useState('');

  async function submit(){
    const payload = { username, email, password, company_name: company };
    const isManu = role === 'Manufacturer';
    try {
      await backend.register(payload, isManu);
      window.toast?.success?.('Registration successful. Please login.');
      window.location.hash = '#/login';
    } catch (e) {
      window.toast?.error?.(e?.response?.data?.detail || 'Registration failed');
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Register</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Email</label>
            <input value={email} onChange={(e)=>setEmail(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Password</label>
            <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">Role</label>
            <select value={role} onChange={(e)=>setRole(e.target.value)} className="w-full border rounded px-3 py-2">
              <option>Medical</option>
              <option>Manufacturer</option>
            </select>
          </div>
          {role === 'Manufacturer' && (
            <div>
              <label className="block text-sm mb-1">Company Name</label>
              <input value={company} onChange={(e)=>setCompany(e.target.value)} className="w-full border rounded px-3 py-2" />
            </div>
          )}
          <div className="pt-2">
            <button className="bg-brand-green text-white px-4 py-2 rounded" onClick={submit}>Register</button>
          </div>
        </div>
      </div>
    </main>
  );
}
