// Medical Device Risk Assessment SPA (no-JSX version)
(function(){
  if (window.__APP_BOOTSTRAPPED__) { return; }
  if (!(window.React && window.ReactDOM)) {
    const root = document.getElementById('root');
    if (root) root.innerHTML = '<div style="padding:16px;color:#dc2626;font-family:Inter,ui-sans-serif,system-ui">Failed to load React libraries. Ensure CDN access or host libs locally.</div>';
    return;
  }
  const ReactRouterDOM = window.ReactRouterDOM || {};
  const ChartJS = window.Chart;
  const ReactToastify = window.ReactToastify || {};
  const DOMPurify = window.DOMPurify;
  const axios = window.axios;

  const { useState, useEffect, useRef, useContext, createContext, Fragment } = React;
  const { HashRouter, Routes, Route, Link, useNavigate, Navigate } = ReactRouterDOM;
  const { ToastContainer, toast } = {
    ToastContainer: ReactToastify.ToastContainer || (()=>null),
    toast: ReactToastify.toast || { success: console.log, error: console.error, info: console.info }
  };

  const API_BASE_URL = window.REACT_APP_API_URL || 'http://localhost:8000';
  const sanitize = (val) => DOMPurify ? DOMPurify.sanitize(val, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] }).trim() : (val||'').toString().trim();

  const getToken = () => localStorage.getItem('token');
  const setToken = (t) => localStorage.setItem('token', t);
  const clearToken = () => localStorage.removeItem('token');
  const redirectToLogin = () => { window.location.hash = '#/login'; };

  const api = axios.create({ baseURL: API_BASE_URL, headers: { 'Content-Type': 'application/json' } });
  api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  api.interceptors.response.use(
    (resp) => resp,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        clearToken();
        toast.error('Session expired. Please login again.');
        redirectToLogin();
      } else if (status === 403) {
        toast.error('You do not have permission to perform this action.');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      }
      return Promise.reject(error);
    }
  );

  function createMockBackend(){
    const now = new Date().toISOString();
    let devices = [
      { _id: 'd1', device_name: 'CardioMon 3000', manufacturer_name: 'MediTech', risk_class: 'Low', risk_percent: 12.5, suggested_alternatives: ['CardioMon 2000'], source: 'mock', username: 'alice', created_at: now },
      { _id: 'd2', device_name: 'NeuroScan X', manufacturer_name: 'NeuroCorp', risk_class: 'High', risk_percent: 78.9, suggested_alternatives: ['NeuroScan Lite'], source: 'mock', username: 'bob', created_at: now },
      { _id: 'd3', device_name: 'UltraSound Pro', manufacturer_name: 'SonoLabs', risk_class: 'Medium', risk_percent: 43.1, suggested_alternatives: ['UltraSound Mini'], source: 'mock', username: 'alice', created_at: now },
    ];
    let currentPrediction = null;

    const predictRisk = ({ device_name, manufacturer_name, username }) => {
      const name = `${device_name} ${manufacturer_name}`.toLowerCase();
      let probs = { Low: 30, Medium: 40, High: 30 };
      if (name.includes('x')) probs = { Low: 10, Medium: 20, High: 70 };
      if (name.includes('pro')) probs = { Low: 55, Medium: 30, High: 15 };
      const entries = Object.entries(probs).sort((a,b)=>b[1]-a[1]);
      const top = entries[0][0];
      const percent = entries[0][1];
      const _id = `mock-${Math.random().toString(36).slice(2,9)}`;
      const res = {
        _id,
        device_name,
        manufacturer_name,
        risk_class: top,
        risk_percent: percent,
        probabilities: probs,
        suggested_alternatives: ['Alt A', 'Alt B'],
        username: username || 'mock-user',
        created_at: new Date().toISOString(),
      };
      devices = [{...res}, ...devices];
      currentPrediction = res;
      return Promise.resolve({ data: res });
    };

    return {
      health: () => Promise.resolve({ data: { status: 'ok' } }),
      register: (payload, isManufacturer=false) => Promise.resolve({ data: { message: 'Registered', role: isManufacturer ? 'manufacturer' : 'user' } }),
      login: (payload, isManufacturer=false) => Promise.resolve({ data: { access_token: 'mock-token', token_type: 'bearer', role: isManufacturer ? 'manufacturer' : 'user', username: payload.get ? payload.get('username') : 'user', company_name: isManufacturer ? 'MockCo' : undefined } }),
      devices: () => Promise.resolve({ data: devices }),
      deviceById: (id) => Promise.resolve({ data: devices.find(d=>d._id===id) || null }),
      predict: (payload) => predictRisk(payload),
      feedback: (device_id, payload) => Promise.resolve({ data: { message: 'Feedback received', device_id } }),
      modelInfo: () => Promise.resolve({ data: { version: 'mock-1.0' } }),
      getLastPrediction: () => currentPrediction,
    };
  }

  const BackendContext = createContext(null);
  function BackendProvider(props){
    const [backend, setBackend] = useState(null);
    const [ready, setReady] = useState(false);

    useEffect(() => {
      (async () => {
        try {
          await api.get('/health');
          setBackend({
            health: () => api.get('/health'),
            register: (payload, isManufacturer=false) => api.post(isManufacturer ? '/register/manufacturer' : '/register', payload),
            login: (formData, isManufacturer=false) => axios.post(
              `${API_BASE_URL}${isManufacturer ? '/login/manufacturer' : '/login'}`,
              formData,
              { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            ),
            devices: () => api.get('/devices'),
            deviceById: (id) => api.get(`/devices/${encodeURIComponent(id)}`),
            predict: (payload) => api.post('/predict', payload),
            feedback: (device_id, payload) => api.post(`/feedback/${encodeURIComponent(device_id)}`, payload),
            modelInfo: () => api.get('/model_info'),
            getLastPrediction: () => null,
          });
        } catch (e) {
          const mock = createMockBackend();
          toast.info('Backend not reachable. Running in mock mode.');
          setBackend(mock);
        } finally { setReady(true); }
      })();
    }, []);

    if (!ready || !backend) return React.createElement('div', { className: 'flex items-center justify-center h-screen text-brand-blue' }, 'Loading...');
    return React.createElement(BackendContext.Provider, { value: backend }, props.children);
  }
  const useBackend = () => useContext(BackendContext);

  const AuthContext = createContext(null);
  function AuthProvider(props){
    const [user, setUser] = useState(() => {
      try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
    });
    const loginFn = ({ token, role, username, company_name }) => {
      if (token) setToken(token);
      const u = { role, username, company_name };
      localStorage.setItem('user', JSON.stringify(u));
      setUser(u);
    };
    const logoutFn = () => {
      clearToken();
      localStorage.removeItem('user');
      setUser(null);
    };
    return React.createElement(AuthContext.Provider, { value: { user, login: loginFn, logout: logoutFn } }, props.children);
  }
  const useAuth = () => useContext(AuthContext);

  const h = React.createElement;

  function Header(){
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const handleLogout = () => { logout(); toast.success('Logged out'); navigate('/login'); };
    return h('header', { className: 'bg-white/90 backdrop-blur border-b border-gray-100 sticky top-0 z-30' },
      h('div', { className: 'max-w-7xl mx-auto px-4 py-3 flex items-center justify-between' },
        h(Link, { to: '/', className: 'flex items-center gap-3' },
          h('div', { className: 'w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold' }, 'MD'),
          h('div', null,
            h('h1', { className: 'text-lg md:text-xl font-semibold text-brand-blue' }, 'Medical Device Risk Assessment'),
            h('p', { className: 'text-xs text-gray-500' }, 'Assess risks. Improve quality.')
          )
        ),
        h('nav', { className: 'flex items-center gap-3 md:gap-6' },
          h(Link, { className: 'text-sm text-gray-700 hover:text-brand-blue', to: '/' }, 'Home'),
          (user && user.role === 'user') && [
            h(Link, { key: 'md1', className: 'text-sm text-gray-700 hover:text-brand-blue', to: '/medical-dashboard' }, 'Medical Dashboard'),
            h(Link, { key: 'md2', className: 'text-sm text-gray-700 hover:text-brand-blue', to: '/device-risk-checker' }, 'Risk Checker')
          ],
          (user && user.role === 'manufacturer') && [
            h(Link, { key: 'mf1', className: 'text-sm text-gray-700 hover:text-brand-blue', to: '/manufacturer-dashboard' }, 'Manufacturer Dashboard')
          ],
          (!user) && [
            h(Link, { key: 'l1', className: 'px-3 py-1.5 rounded-md text-sm text-brand-blue hover:bg-blue-50', to: '/login' }, 'Login'),
            h(Link, { key: 'l2', className: 'px-3 py-1.5 rounded-md text-sm bg-brand-green text-white hover:bg-green-600', to: '/register' }, 'Register')
          ],
          (user) && h('button', { onClick: handleLogout, className: 'px-3 py-1.5 rounded-md text-sm bg-gray-100 hover:bg-gray-200 text-gray-700' }, 'Logout')
        )
      )
    );
  }

  function Footer(){
    return h('footer', { className: 'mt-16 border-t border-gray-200 bg-white' },
      h('div', { className: 'max-w-7xl mx-auto px-4 py-6 text-sm text-gray-500 flex flex-col md:flex-row items-center justify-between gap-2' },
        h('p', null, `© ${new Date().getFullYear()} MedRisk. All rights reserved.`),
        h('p', { className: 'text-xs' }, 'Built with React, Tailwind CSS, Chart.js')
      )
    );
  }

  function Landing(){
    return h('div', null,
      h('section', { className: 'bg-gradient-to-br from-blue-50 to-green-50' },
        h('div', { className: 'max-w-7xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center' },
          h('div', null,
            h('h2', { className: 'text-3xl md:text-4xl font-bold text-brand-blue' }, 'Assess medical device risks for hospitals and improve manufacturing quality'),
            h('p', { className: 'mt-4 text-gray-700' }, 'A unified platform for medical users and manufacturers to evaluate device risk, visualize insights, and reduce faults.'),
            h('div', { className: 'mt-6 flex gap-3' },
              h(Link, { to: '/login', className: 'px-5 py-2.5 rounded-md bg-brand-blue text-white hover:bg-blue-700' }, 'Login'),
              h(Link, { to: '/register', className: 'px-5 py-2.5 rounded-md bg-brand-green text-white hover:bg-green-600' }, 'Register')
            )
          ),
          h('div', { className: 'bg-white rounded-xl shadow-lg p-6 border border-gray-100' },
            h('div', { className: 'grid grid-cols-1 sm:grid-cols-3 gap-4' },
              h('div', { className: 'p-4 rounded-lg bg-blue-50' },
                h('h3', { className: 'font-semibold text-brand-blue' }, 'Device Risk Checker'),
                h('p', { className: 'text-sm text-gray-600 mt-2' }, 'Assess device risk probability by device and manufacturer.')
              ),
              h('div', { className: 'p-4 rounded-lg bg-green-50' },
                h('h3', { className: 'font-semibold text-brand-green' }, 'Manufacturer Insights'),
                h('p', { className: 'text-sm text-gray-600 mt-2' }, 'Identify patterns and improve device quality.')
              ),
              h('div', { className: 'p-4 rounded-lg bg-yellow-50' },
                h('h3', { className: 'font-semibold text-brand-yellow' }, 'Fault Reduction'),
                h('p', { className: 'text-sm text-gray-600 mt-2' }, 'Use feedback loops to reduce high-risk outcomes.')
              )
            )
          )
        )
      )
    );
  }

  function Register(){
    const backend = useBackend();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState('user');
    const [form, setForm] = useState({ username: '', email: '', password: '', company_name: '' });

    const submit = async () => {
      try {
        setLoading(true);
        const payload = { username: sanitize(form.username), email: sanitize(form.email), password: form.password };
        if (role === 'manufacturer') payload.company_name = sanitize(form.company_name);
        await backend.register(payload, role === 'manufacturer');
        toast.success('Registration successful. Please login.');
        navigate('/login');
      } catch (e) {
        const msg = e?.response?.data?.detail || 'Registration failed';
        toast.error(msg);
      } finally { setLoading(false); }
    };

    return h('div', { className: 'max-w-md mx-auto mt-10' },
      h('div', { className: 'bg-white rounded-lg shadow-lg p-6 border border-gray-100' },
        h('h2', { className: 'text-2xl font-semibold text-brand-blue' }, 'Create an account'),
        h('p', { className: 'text-sm text-gray-600 mt-1' }, 'Choose role: Medical or Manufacturer'),
        h('div', { className: 'mt-4 space-y-3' },
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Username'),
            h('input', { value: form.username, onChange: e=>setForm({...form, username:e.target.value}), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'john_doe' })
          ),
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Email'),
            h('input', { type: 'email', value: form.email, onChange: e=>setForm({...form, email:e.target.value}), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'you@example.com' })
          ),
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Password'),
            h('input', { type: 'password', value: form.password, onChange: e=>setForm({...form, password:e.target.value}), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: '••••••••' })
          ),
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Role'),
            h('select', { value: role, onChange: e=>setRole(e.target.value), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue' },
              h('option', { value: 'user' }, 'Medical'),
              h('option', { value: 'manufacturer' }, 'Manufacturer')
            )
          ),
          role === 'manufacturer' && h('div', null,
            h('label', { className: 'block text-sm' }, 'Company Name'),
            h('input', { value: form.company_name, onChange: e=>setForm({...form, company_name:e.target.value}), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'Acme Medical Inc.' })
          ),
          h('button', { type: 'button', onClick: submit, disabled: loading, className: 'w-full mt-2 px-4 py-2 rounded-md bg-brand-green text-white hover:bg-green-600 disabled:opacity-50' }, loading ? 'Creating account...' : 'Register')
        )
      )
    );
  }

  function Login(){
    const backend = useBackend();
    const { login } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState('user');
    const [form, setForm] = useState({ username: '', password: '' });

    const submit = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        params.append('username', sanitize(form.username));
        params.append('password', form.password);
        const isManufacturer = role === 'manufacturer';
        const { data } = await backend.login(params, isManufacturer);
        const token = data?.access_token || data?.token;
        if (!token) throw new Error('No token received');
        login({ token, role: isManufacturer ? 'manufacturer' : 'user', username: form.username, company_name: data?.company_name });
        toast.success('Login successful');
        navigate(isManufacturer ? '/manufacturer-dashboard' : '/medical-dashboard');
      } catch (e) {
        const status = e?.response?.status;
        if (status === 401) toast.error('Invalid credentials'); else toast.error('Login failed');
      } finally { setLoading(false); }
    };

    return h('div', { className: 'max-w-md mx-auto mt-10' },
      h('div', { className: 'bg-white rounded-lg shadow-lg p-6 border border-gray-100' },
        h('h2', { className: 'text-2xl font-semibold text-brand-blue' }, 'Sign in'),
        h('div', { className: 'mt-4 space-y-3' },
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Username'),
            h('input', { value: form.username, onChange: e=>setForm({...form, username:e.target.value}), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'john_doe' })
          ),
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Password'),
            h('input', { type: 'password', value: form.password, onChange: e=>setForm({...form, password:e.target.value}), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: '••••••••' })
          ),
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Role'),
            h('select', { value: role, onChange: e=>setRole(e.target.value), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue' },
              h('option', { value: 'user' }, 'Medical'),
              h('option', { value: 'manufacturer' }, 'Manufacturer')
            )
          ),
          h('button', { type: 'button', onClick: submit, disabled: loading, className: 'w-full mt-2 px-4 py-2 rounded-md bg-brand-blue text-white hover:bg-blue-700 disabled:opacity-50' }, loading ? 'Signing in...' : 'Login')
        )
      )
    );
  }

  function MedicalDashboard(){
    const { user } = useAuth();
    const backend = useBackend();
    const [devices, setDevices] = useState([]);
    useEffect(()=>{ (async()=>{ try{ const {data}=await backend.devices(); setDevices(data||[]);}catch{ setDevices([]);} })(); },[]);
    const myDevices = devices.filter(d => d.username === (user&&user.username) || !d.username);
    return h('div', { className: 'max-w-7xl mx-auto px-4 mt-8' },
      h('h2', { className: 'text-2xl font-semibold text-brand-blue' }, `Welcome, ${ (user&&user.username) || 'Medical User'}`),
      h('div', { className: 'mt-6 grid grid-cols-1 md:grid-cols-2 gap-6' },
        h(Link, { to: '/device-risk-checker', className: 'block p-6 bg-white rounded-lg shadow-md hover:shadow-lg border border-gray-100' },
          h('h3', { className: 'text-lg font-semibold' }, 'Device Risk Checker'),
          h('p', { className: 'text-sm text-gray-600 mt-2' }, 'Quickly assess device risk by manufacturer and name.')
        ),
        h('div', { className: 'p-6 bg-white rounded-lg shadow-md border border-gray-100' },
          h('h3', { className: 'text-lg font-semibold' }, 'Recent Activity'),
          h('div', { className: 'mt-3 overflow-auto' },
            h('table', { className: 'w-full table-auto text-sm' },
              h('thead', null,
                h('tr', { className: 'text-left bg-gray-50' },
                  h('th', { className: 'p-2' }, 'Device'),
                  h('th', { className: 'p-2' }, 'Manufacturer'),
                  h('th', { className: 'p-2' }, 'Risk'),
                  h('th', { className: 'p-2' }, 'Date')
                )
              ),
              h('tbody', null,
                (myDevices.slice(0,6).map(d => h('tr', { key: d._id, className: 'border-t hover:bg-gray-50' },
                  h('td', { className: 'p-2' }, d.device_name),
                  h('td', { className: 'p-2' }, d.manufacturer_name),
                  h('td', { className: 'p-2' }, h('span', { className: `px-2 py-1 rounded text-white ${d.risk_class==='High'?'bg-brand-red':d.risk_class==='Medium'?'bg-brand-yellow text-black':'bg-brand-green'}` }, d.risk_class)),
                  h('td', { className: 'p-2' }, new Date(d.created_at).toLocaleString())
                ))).concat(myDevices.length===0 ? [h('tr', { key: 'empty' }, h('td', { className: 'p-3 text-gray-500', colSpan: 4 }, 'No recent activity'))] : [])
              )
            )
          )
        )
      )
    );
  }

  function DeviceRiskChecker(){
    const backend = useBackend();
    const navigate = useNavigate();
    const [manufacturerName, setManufacturerName] = useState('');
    const [deviceName, setDeviceName] = useState('');
    const [devices, setDevices] = useState([]);
    useEffect(()=>{ (async()=>{ try{ const {data}=await backend.devices(); setDevices(Array.isArray(data)?data:[]);}catch{ setDevices([]);} })(); },[]);
    const manufacturers = Array.from(new Set(devices.map(d=>d.manufacturer_name).filter(Boolean)));

    const submit = async () => {
      const device_name = sanitize(deviceName);
      const manufacturer_name = sanitize(manufacturerName);
      if (!device_name || !manufacturer_name) { toast.error('Please enter both device and manufacturer names.'); return; }
      try { const { data } = await backend.predict({ device_name, manufacturer_name }); localStorage.setItem('lastPrediction', JSON.stringify(data)); toast.success('Prediction ready'); navigate('/risk-result'); }
      catch(e){ const status = e?.response?.status; if (status === 401) redirectToLogin(); else toast.error('Prediction failed'); }
    };

    return h('div', { className: 'max-w-5xl mx-auto px-4 mt-8' },
      h('div', { className: 'bg-white rounded-lg shadow-md p-6 border border-gray-100' },
        h('h2', { className: 'text-xl font-semibold text-brand-blue' }, 'Device Risk Checker'),
        h('div', { className: 'mt-4 grid md:grid-cols-2 gap-4' },
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Manufacturer Name'),
            h('input', { list: 'manufacturers', value: manufacturerName, onChange: e=>setManufacturerName(e.target.value), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'e.g., MediTech' }),
            h('datalist', { id: 'manufacturers' }, manufacturers.map(m=>h('option', { key: m, value: m })))
          ),
          h('div', null,
            h('label', { className: 'block text-sm' }, 'Device Name'),
            h('input', { value: deviceName, onChange: e=>setDeviceName(e.target.value), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'e.g., CardioMon 3000' })
          )
        ),
        h('button', { type: 'button', onClick: submit, className: 'mt-4 px-5 py-2 rounded-md bg-brand-green text-white hover:bg-green-600' }, 'Assess Risk')
      ),
      h('div', { className: 'mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100' },
        h('h3', { className: 'text-lg font-semibold' }, 'Recent Risk Checks'),
        h('div', { className: 'mt-3 overflow-auto' },
          h('table', { className: 'w-full table-auto text-sm' },
            h('thead', null,
              h('tr', { className: 'text-left bg-gray-50' },
                h('th', { className: 'p-2' }, 'Device Name'),
                h('th', { className: 'p-2' }, 'Manufacturer'),
                h('th', { className: 'p-2' }, 'Risk Class'),
                h('th', { className: 'p-2' }, 'Date')
              )
            ),
            h('tbody', null,
              (devices.slice(0,10).map(d => h('tr', { key: d._id, className: 'border-t hover:bg-gray-50' },
                h('td', { className: 'p-2' }, d.device_name),
                h('td', { className: 'p-2' }, d.manufacturer_name),
                h('td', { className: 'p-2' }, d.risk_class),
                h('td', { className: 'p-2' }, new Date(d.created_at).toLocaleString())
              ))).concat(devices.length===0 ? [h('tr', { key: 'empty' }, h('td', { className: 'p-3 text-gray-500', colSpan: 4 }, 'No records'))] : [])
            )
          )
        )
      )
    );
  }

  function RiskChart(props){
    const { type, dataConfig, options, className } = props;
    const canvasRef = useRef(null);
    const chartRef = useRef(null);
    useEffect(()=>{
      if (!ChartJS) return;
      const ctx = canvasRef.current.getContext('2d');
      if (chartRef.current) chartRef.current.destroy();
      chartRef.current = new ChartJS(ctx, { type, data: dataConfig, options });
      return ()=>{ if (chartRef.current) chartRef.current.destroy(); };
    }, [type, JSON.stringify(dataConfig), JSON.stringify(options)]);
    return h('canvas', { ref: canvasRef, className });
  }

  function FeedbackForm(props){
    const { deviceId, predictedRisk } = props;
    const backend = useBackend();
    const { user } = useAuth();
    const [rating, setRating] = useState('');
    const [feedback, setFeedback] = useState('');
    const [actualRisk, setActualRisk] = useState('');
    const [loading, setLoading] = useState(false);
    if (!(user && user.role === 'manufacturer') || !deviceId) return null;

    const submit = async () => {
      if (!rating) { toast.error('Please select a rating'); return; }
      try{ setLoading(true); await backend.feedback(deviceId, { user_rating: Number(rating), user_feedback: sanitize(feedback), predicted_risk: predictedRisk, actual_risk: actualRisk || undefined }); toast.success('Feedback submitted'); setRating(''); setFeedback(''); setActualRisk(''); }
      catch(e){ const status = e?.response?.status; if (status === 401) redirectToLogin(); else if (status === 403) toast.error('Not allowed'); else toast.error('Failed to submit feedback'); }
      finally{ setLoading(false); }
    };

    return h('div', { className: 'mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100' },
      h('h3', { className: 'text-lg font-semibold' }, 'Provide Feedback'),
      h('div', { className: 'mt-3 grid md:grid-cols-3 gap-4' },
        h('div', null,
          h('label', { className: 'block text-sm' }, 'Rating'),
          h('select', { value: rating, onChange: e=>setRating(e.target.value), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue' },
            h('option', { value: '' }, 'Select'),
            [1,2,3,4,5].map(n => h('option', { key: n, value: n }, n))
          )
        ),
        h('div', { className: 'md:col-span-2' },
          h('label', { className: 'block text-sm' }, 'Feedback'),
          h('textarea', { value: feedback, onChange: e=>setFeedback(e.target.value), rows: 2, className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue', placeholder: 'Observations or comments...' })
        ),
        h('div', null,
          h('label', { className: 'block text-sm' }, 'Actual Risk (optional)'),
          h('select', { value: actualRisk, onChange: e=>setActualRisk(e.target.value), className: 'mt-1 w-full border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-blue' },
            h('option', { value: '' }, 'Select'),
            ['Low','Medium','High'].map(r => h('option', { key: r, value: r }, r))
          )
        )
      ),
      h('button', { type: 'button', disabled: loading, onClick: submit, className: 'mt-4 px-5 py-2 rounded-md bg-brand-blue text-white hover:bg-blue-700 disabled:opacity-50' }, 'Submit Feedback')
    );
  }

  function RiskAssessmentResult(){
    const { user } = useAuth();
    const [result, setResult] = useState(null);
    useEffect(()=>{ const raw = localStorage.getItem('lastPrediction'); if (raw){ try{ setResult(JSON.parse(raw)); }catch{ setResult(null);} } },[]);
    if (!result) return h('div', { className: 'max-w-3xl mx-auto px-4 mt-10' }, h('div', { className: 'bg-white rounded-lg shadow-md p-6 border border-gray-100' }, h('p', { className: 'text-gray-600' }, 'No prediction result available. Please run a risk check.')));
    const colors = { Low: '#22C55E', Medium: '#FBBF24', High: '#EF4444' };
    const borderColors = { Low: '#14532D', Medium: '#854D0E', High: '#991B1B' };
    const probabilities = result.probabilities || { Low: 0, Medium: 0, High: 0 };
    const pieData = { labels: ['Low', 'Medium', 'High'], datasets: [{ data: [probabilities.Low||0, probabilities.Medium||0, probabilities.High||0], backgroundColor: [colors.Low, colors.Medium, colors.High], borderColor: [borderColors.Low, borderColors.Medium, borderColors.High], borderWidth: 1 }] };
    const pieOptions = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Risk Probability Breakdown' } } };
    return h('div', { className: 'max-w-4xl mx-auto px-4 mt-8' },
      h('div', { className: 'bg-white rounded-lg shadow-md p-6 border border-gray-100' },
        h('h2', { className: 'text-xl font-semibold text-brand-blue' }, 'Risk Assessment Result'),
        h('div', { className: 'mt-4 grid md:grid-cols-2 gap-6' },
          h('div', { className: 'space-y-2' },
            h('div', null, h('span', { className: 'text-sm text-gray-500' }, 'Device'), h('p', { className: 'font-medium' }, result.device_name)),
            h('div', null, h('span', { className: 'text-sm text-gray-500' }, 'Manufacturer'), h('p', { className: 'font-medium' }, result.manufacturer_name)),
            h('div', null, h('span', { className: 'text-sm text-gray-500' }, 'Risk Class'),
              h('p', { className: `mt-1 inline-block px-2 py-1 rounded text-white ${result.risk_class==='High'?'bg-brand-red':result.risk_class==='Medium'?'bg-brand-yellow text-black':'bg-brand-green'}` }, `${result.risk_class} (${Number(result.risk_percent).toFixed(1)}%)`)
            )
          ),
          h('div', null, h(RiskChart, { type: 'pie', dataConfig: pieData, options: pieOptions, className: 'max-w-sm' }))
        ),
        h('div', { className: 'mt-6' },
          h('h3', { className: 'text-lg font-semibold' }, 'Suggested Alternatives'),
          h('ul', { className: 'list-disc pl-6 mt-2 text-sm text-gray-700' },
            (result.suggested_alternatives||[]).map((alt, idx) => h('li', { key: idx }, alt)).concat((!result.suggested_alternatives || result.suggested_alternatives.length===0) ? [h('li', { key: 'none', className: 'list-none text-gray-500' }, 'No alternatives provided')] : [])
          )
        ),
        h(FeedbackForm, { deviceId: result._id, predictedRisk: result.risk_class })
      )
    );
  }

  function ManufacturerDashboard(){
    const { user } = useAuth();
    const backend = useBackend();
    const [devices, setDevices] = useState([]);
    useEffect(()=>{ (async()=>{ try{ const {data}=await backend.devices(); setDevices(Array.isArray(data)?data:[]);}catch{ setDevices([]);} })(); },[]);
    const myDevices = devices.filter(d => (d.manufacturer_name||'').toLowerCase() === ((user&&user.company_name)||'').toLowerCase());
    const counts = myDevices.reduce((acc, d)=>{ acc[d.risk_class]=(acc[d.risk_class]||0)+1; return acc; }, { Low:0, Medium:0, High:0 });
    const barData = { labels: ['Low Risk','Medium Risk','High Risk'], datasets: [{ label: 'Device Count', data: [counts.Low||0, counts.Medium||0, counts.High||0], backgroundColor: ['#22C55E','#FBBF24','#EF4444'], borderColor: ['#14532D','#854D0E','#991B1B'], borderWidth: 1 }] };
    const barOptions = { responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Device Risk Distribution' } }, scales: { y: { beginAtZero: true } } };

    return h('div', { className: 'max-w-7xl mx-auto px-4 mt-8' },
      h('h2', { className: 'text-2xl font-semibold text-brand-blue' }, `Welcome, ${ (user&&user.company_name) || 'Manufacturer'}`),
      h('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 mt-6' },
        h('div', { className: 'md:col-span-2 bg-white rounded-lg shadow-md p-6 border border-gray-100' },
          h('h3', { className: 'text-lg font-semibold' }, 'Risk Distribution'),
          h(RiskChart, { type: 'bar', dataConfig: barData, options: barOptions })
        ),
        h('div', { className: 'bg-white rounded-lg shadow-md p-6 border border-gray-100' },
          h('h3', { className: 'text-lg font-semibold' }, 'High-risk Alerts'),
          h('ul', { className: 'mt-3 space-y-2' },
            (myDevices.filter(d=>d.risk_class==='High').slice(0,5).map(d => h('li', { key: d._id, className: 'p-3 rounded-md bg-red-50 border border-red-200 text-sm' },
              h('span', { className: 'font-medium text-brand-red' }, d.device_name),
              h('div', { className: 'text-gray-600' }, new Date(d.created_at).toLocaleString())
            ))).concat(myDevices.filter(d=>d.risk_class==='High').length===0 ? [h('li', { key: 'none', className: 'text-sm text-gray-500' }, 'No high-risk devices')] : [])
          )
        )
      ),
      h('div', { className: 'mt-6 bg-white rounded-lg shadow-md p-6 border border-gray-100' },
        h('h3', { className: 'text-lg font-semibold' }, 'Devices'),
        h('div', { className: 'mt-3 overflow-auto' },
          h('table', { className: 'w-full table-auto text-sm' },
            h('thead', null,
              h('tr', { className: 'text-left bg-gray-50' },
                h('th', { className: 'p-2' }, 'Device'),
                h('th', { className: 'p-2' }, 'Risk'),
                h('th', { className: 'p-2' }, 'Created')
              )
            ),
            h('tbody', null,
              (myDevices.map(d=>h('tr', { key: d._id, className: 'border-t hover:bg-gray-50' },
                h('td', { className: 'p-2' }, d.device_name),
                h('td', { className: 'p-2' }, h('span', { className: `px-2 py-1 rounded text-white ${d.risk_class==='High'?'bg-brand-red':d.risk_class==='Medium'?'bg-brand-yellow text-black':'bg-brand-green'}` }, d.risk_class)),
                h('td', { className: 'p-2' }, new Date(d.created_at).toLocaleString())
              ))).concat(myDevices.length===0 ? [h('tr', { key: 'empty' }, h('td', { className: 'p-3 text-gray-500', colSpan: 3 }, 'No devices'))] : [])
            )
          )
        )
      )
    );
  }

  function ProtectedRoute(props){
    const { roles, children } = props;
    const { user } = useAuth();
    if (!getToken() || !user) return h(Navigate, { to: '/login', replace: true });
    if (roles && !(roles.includes(user.role))) return h(Navigate, { to: '/login', replace: true });
    return children;
  }

  function App(){
    return h(HashRouter, null,
      h(AuthProvider, null,
        h(Fragment, null,
          h(Header, null),
          h('main', { className: 'min-h-[70vh]' },
            h(Routes, null,
              h(Route, { path: '/', element: h(Landing, null) }),
              h(Route, { path: '/login', element: h(Login, null) }),
              h(Route, { path: '/register', element: h(Register, null) }),
              h(Route, { path: '/medical-dashboard', element: h(ProtectedRoute, { roles: ['user'], children: h(MedicalDashboard, null) }) }),
              h(Route, { path: '/device-risk-checker', element: h(ProtectedRoute, { roles: ['user'], children: h(DeviceRiskChecker, null) }) }),
              h(Route, { path: '/risk-result', element: h(ProtectedRoute, { roles: ['user','manufacturer'], children: h(RiskAssessmentResult, null) }) }),
              h(Route, { path: '/manufacturer-dashboard', element: h(ProtectedRoute, { roles: ['manufacturer'], children: h(ManufacturerDashboard, null) }) })
            )
          ),
          h(Footer, null),
          h(ToastContainer, { position: 'top-right', autoClose: 2500, hideProgressBar: true, closeOnClick: true, pauseOnHover: true, theme: 'colored' })
        )
      )
    );
  }

  function Root(){
    return h(BackendProvider, null, h(App, null));
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(h(Root, null));
  window.__APP_BOOTSTRAPPED__ = true;
})();
