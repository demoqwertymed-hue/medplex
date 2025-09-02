/* src/pages/Login.js */
import React, { useState } from 'react';

export default function Login({ backend, onLogin }){
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Medical');

  async function handleLogin(){
    const isManu = role === 'Manufacturer';
    // FastAPI expects x-www-form-urlencoded for OAuth2PasswordRequestForm; here we use FormData
    const form = new URLSearchParams();
    form.set('username', username);
    form.set('password', password);
    try {
      const { data } = await backend.login(form, isManu);
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify({ username, role: data.role || (isManu ? 'manufacturer' : 'user'), company_name: data.company_name }));
      onLogin?.(data);
    } catch (e) {
      window.toast?.error?.(e?.response?.data?.detail || 'Invalid credentials');
    }
  }

  return (
    <main className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Login</h2>
        <div className="space-y-3">
          <div>
            <label className="block text-sm mb-1">Username</label>
            <input value={username} onChange={(e)=>setUsername(e.target.value)} className="w-full border rounded px-3 py-2" />
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
          <div className="pt-2">
            <button className="bg-brand-blue text-white px-4 py-2 rounded" onClick={handleLogin}>Login</button>
          </div>
        </div>
      </div>
    </main>
  );
}
