import React, { useEffect, useState, createContext, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  LayoutDashboard,
  Receipt,
  WalletCards,
  Tags,
  ChartNoAxesCombined,
  UserRound,
  Settings as SettingsIcon,
  LogOut,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import './styles.css';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api'
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const AuthContext = createContext();
const useAuth = () => useContext(AuthContext);

function Provider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(credentials) {
    const res = await api.post('/auth/login', credentials);
    localStorage.setItem('token', res.data.token);
    setUser(res.data.user);
    return res.data;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function Guard({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="center">Loading application...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function Shell({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();

  const links = [
    ['/dashboard', 'Dashboard', LayoutDashboard],
    ['/transactions', 'Transactions', Receipt],
    ['/budgets', 'Budgets', WalletCards],
    ['/categories', 'Categories', Tags],
    ['/reports', 'Reports', ChartNoAxesCombined],
    ['/profile', 'Profile', UserRound],
    ['/settings', 'Settings', SettingsIcon]
  ];

  return (
    <div className="app">
      <aside>
        <div className="brand"><i>↗</i> ledgerly</div>
        <small>YOUR MONEY, CLEARER</small>
        <nav>
          {links.map(([path, name, Icon]) => (
            <Link
              key={path}
              className={loc.pathname === path ? 'active' : ''}
              to={path}
            >
              <Icon size={17} />
              {name}
            </Link>
          ))}
        </nav>
        <button onClick={() => { logout(); nav('/login'); }}>
          <LogOut size={16} />Log out
        </button>
      </aside>
      <main>
        <header>
          <div>
            <small>PERSONAL FINANCE</small>
            <h2>{user?.fullName}'s money map</h2>
          </div>
          <b className="avatar">{user?.fullName?.[0]?.toUpperCase() || 'U'}</b>
        </header>
        {children}
      </main>
    </div>
  );
}

const formatMoney = val =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(val || 0);

function Auth({ reg = false }) {
  const { login } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [formData, setFormData] = useState({});
  const [err, setErr] = useState('');
  const [successMsg, setSuccessMsg] = useState(loc.state?.msg || '');

  async function handleSubmit(e) {
    e.preventDefault();
    setErr('');
    setSuccessMsg('');
    try {
      if (reg) {
        if (formData.password !== formData.confirmPassword) {
          setErr('Passwords do not match');
          return;
        }
        await api.post('/auth/register', formData);
        nav('/login', { state: { msg: 'Account created successfully! Please log in.' } });
      } else {
        await login(formData);
        nav('/dashboard');
      }
    } catch (errRes) {
      setErr(errRes.response?.data?.message || 'Authentication request failed');
    }
  }

  return (
    <div className="auth">
      <section className="art">
        <div className="brand"><i>↗</i> ledgerly</div>
        <div>
          <small>MONEY, WITHOUT THE NOISE</small>
          <h1>{reg ? 'Build a better money habit.' : 'Your whole financial picture, in one place.'}</h1>
        </div>
      </section>
      <form onSubmit={handleSubmit}>
        <small>{reg ? 'CREATE YOUR ACCOUNT' : 'WELCOME BACK'}</small>
        <h2>{reg ? 'Start your ledger' : 'Sign in to ledgerly'}</h2>
        {successMsg && <p style={{ background: '#e6f5df', color: '#0f8f78', padding: '10px', borderRadius: '7px', fontSize: '13px' }}>{successMsg}</p>}
        {err && <p className="error">{err}</p>}
        {reg && (
          <input
            required
            placeholder="Full name"
            value={formData.fullName || ''}
            onChange={e => setFormData({ ...formData, fullName: e.target.value })}
          />
        )}
        <input
          required
          type="email"
          placeholder="Email address"
          value={formData.email || ''}
          onChange={e => setFormData({ ...formData, email: e.target.value })}
        />
        <input
          required
          type="password"
          placeholder="Password"
          value={formData.password || ''}
          onChange={e => setFormData({ ...formData, password: e.target.value })}
        />
        {reg && (
          <input
            required
            type="password"
            placeholder="Confirm password"
            value={formData.confirmPassword || ''}
            onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
          />
        )}
        <button className="primary" type="submit">
          {reg ? 'Create account' : 'Log in'} <ArrowUpRight size={16} />
        </button>
        <p className="switch">
          <Link to={reg ? '/login' : '/register'}>
            {reg ? 'Already have an account? Log in' : 'New here? Create an account'}
          </Link>
        </p>
      </form>
    </div>
  );
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/dashboard/summary'),
      api.get('/dashboard/recent-transactions')
    ])
      .then(([sRes, rRes]) => {
        setSummary(sRes.data);
        setRecent(rRes.data || []);
      })
      .catch(err => console.error('Dashboard load error:', err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center">Loading your dashboard...</div>;

  const metrics = [
    { label: 'Total income', value: summary?.totalIncome, color: 'green' },
    { label: 'Total expenses', value: summary?.totalExpenses, color: 'red' },
    { label: 'Current balance', value: summary?.currentBalance, color: '' },
    { label: 'Monthly savings', value: summary?.monthlySavings, color: 'green' }
  ];

  return (
    <>
      <div className="hero">
        <div>
          <small>THIS MONTH</small>
          <h1>Spend with intention.</h1>
          <p>A calm view of where your money is going.</p>
        </div>
        <div>
          <Link className="button income" to="/income">
            <Plus size={16} />Add income
          </Link>{' '}
          <Link className="button expense" to="/expense">
            <Plus size={16} />Add expense
          </Link>
        </div>
      </div>

      <div className="metrics">
        {metrics.map(m => (
          <div className="card metric" key={m.label}>
            <small>{m.label}</small>
            <strong className={m.color}>{formatMoney(m.value)}</strong>
            <span>This month</span>
          </div>
        ))}
      </div>

      <div className="grid">
        <div className="card">
          <small>ACTIVITY</small>
          <h3>Recent transactions</h3>
          {recent.length ? (
            recent.map(t => (
              <div className="tx" key={t.id}>
                <div className="dot">
                  {t.type === 'INCOME' ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}
                </div>
                <div>
                  <b>{t.title}</b>
                  <small>{t.transactionDate} {t.paymentMethod ? `• ${t.paymentMethod}` : ''}</small>
                </div>
                <strong className={t.type === 'INCOME' ? 'green' : 'red'}>
                  {t.type === 'INCOME' ? '+' : '-'}{formatMoney(t.amount)}
                </strong>
              </div>
            ))
          ) : (
            <p className="empty">No transactions yet. Start with an income or expense.</p>
          )}
        </div>

        <div className="card">
          <small>YOUR NEXT MOVE</small>
          <h3>Quick Actions</h3>
          <p style={{ color: '#73817c', marginBottom: '20px' }}>
            Track everything to gain clarity on cash flow and build steady savings.
          </p>
          <div style={{ display: 'grid', gap: '10px' }}>
            <Link className="button income" to="/income" style={{ justifyContent: 'center' }}>
              <Plus size={15} /> Record Income
            </Link>
            <Link className="button expense" to="/expense" style={{ justifyContent: 'center' }}>
              <Plus size={15} /> Record Expense
            </Link>
            <Link className="button primary" to="/transactions" style={{ justifyContent: 'center' }}>
              View All Transactions
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

function Transactions() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/transactions')
      .then(res => setList(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleDelete(id) {
    if (window.confirm('Delete this transaction?')) {
      api.delete(`/transactions/${id}`).then(() => {
        setList(prev => prev.filter(item => item.id !== id));
      });
    }
  }

  return (
    <>
      <div className="page">
        <div>
          <small>MANAGE</small>
          <h1>Transactions</h1>
        </div>
        <div>
          <Link className="button income" to="/income" style={{ marginRight: '8px' }}>
            <Plus size={16} /> Income
          </Link>
          <Link className="button expense" to="/expense">
            <Plus size={16} /> Expense
          </Link>
        </div>
      </div>

      <div className="card table">
        {loading ? (
          <div className="center">Loading transactions...</div>
        ) : list.length ? (
          list.map(x => (
            <div className="row" key={x.id}>
              <div>
                <b>{x.title}</b>
                <small>{x.transactionDate} {x.paymentMethod ? `• ${x.paymentMethod}` : ''} {x.description ? `• ${x.description}` : ''}</small>
              </div>
              <strong className={x.type === 'INCOME' ? 'green' : 'red'}>
                {x.type === 'INCOME' ? '+' : '-'}{formatMoney(x.amount)}
              </strong>
              <button onClick={() => handleDelete(x.id)} title="Delete transaction">
                <Trash2 size={15} />
              </button>
            </div>
          ))
        ) : (
          <p className="empty">No transactions found.</p>
        )}
      </div>
    </>
  );
}

function Entry({ type }) {
  const nav = useNavigate();
  const [formData, setFormData] = useState({
    type: type.toUpperCase(),
    transactionDate: new Date().toISOString().slice(0, 10),
    paymentMethod: 'Cash',
    title: '',
    amount: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/transactions', {
        ...formData,
        amount: Number(formData.amount)
      });
      nav('/dashboard');
    } catch (err) {
      alert(err.response?.data?.message || 'Error saving transaction');
      setSaving(false);
    }
  }

  return (
    <div className="formpage">
      <small>NEW {type.toUpperCase()}</small>
      <h1>Record an {type}.</h1>
      <form className="card form" onSubmit={handleSubmit}>
        <label>
          Title
          <input
            required
            placeholder="e.g. Salary, Rent, Groceries"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
          />
        </label>
        <label>
          Amount (₹)
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={e => setFormData({ ...formData, amount: e.target.value })}
          />
        </label>
        <label>
          Date
          <input
            required
            type="date"
            value={formData.transactionDate}
            onChange={e => setFormData({ ...formData, transactionDate: e.target.value })}
          />
        </label>
        <label>
          Payment Method
          <input
            placeholder="Bank Transfer, UPI, Cash, Credit Card"
            value={formData.paymentMethod}
            onChange={e => setFormData({ ...formData, paymentMethod: e.target.value })}
          />
        </label>
        <label>
          Description
          <input
            placeholder="Optional notes or remarks"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
          />
        </label>
        <button className="primary" type="submit" disabled={saving}>
          {saving ? 'Saving...' : `Save ${type}`}
        </button>
      </form>
    </div>
  );
}

function Categories() {
  const [cats, setCats] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('EXPENSE');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/categories')
      .then(res => setCats(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      const res = await api.post('/categories', { name: name.trim(), type });
      setCats([...cats, res.data]);
      setName('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add category');
    }
  }

  return (
    <>
      <div className="page">
        <div>
          <small>MANAGE</small>
          <h1>Categories</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <small>NEW CATEGORY</small>
          <h3>Add Category</h3>
          <form className="form" onSubmit={handleAdd}>
            <label>
              Category Name
              <input
                required
                placeholder="e.g. Groceries, Entertainment, Rent"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </label>
            <label>
              Type
              <select
                style={{ display: 'block', width: '100%', marginTop: '6px', padding: '11px', border: '1px solid #dfe5dc', borderRadius: '8px', background: '#fcfcfa' }}
                value={type}
                onChange={e => setType(e.target.value)}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </label>
            <button className="primary" type="submit">Create Category</button>
          </form>
        </div>

        <div className="card table">
          <small>EXISTING</small>
          <h3>Your Categories</h3>
          {loading ? (
            <div className="center">Loading categories...</div>
          ) : cats.length ? (
            cats.map(c => (
              <div className="row" key={c.id}>
                <div>
                  <b>{c.name}</b>
                  <small>{c.type}</small>
                </div>
                <strong className={c.type === 'INCOME' ? 'green' : 'red'}>{c.type}</strong>
              </div>
            ))
          ) : (
            <p className="empty">No categories configured yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Budgets() {
  const [budgets, setBudgets] = useState([]);
  const [limit, setLimit] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/budgets')
      .then(res => setBudgets(res.data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!limit) return;
    try {
      const res = await api.post('/budgets', {
        monthlyLimit: Number(limit),
        month: Number(month),
        year: Number(year)
      });
      setBudgets([...budgets, res.data]);
      setLimit('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create budget');
    }
  }

  return (
    <>
      <div className="page">
        <div>
          <small>MANAGE</small>
          <h1>Budgets</h1>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="card">
          <small>NEW BUDGET</small>
          <h3>Set Monthly Budget</h3>
          <form className="form" onSubmit={handleAdd}>
            <label>
              Monthly Limit (₹)
              <input
                required
                type="number"
                min="1"
                placeholder="e.g. 25000"
                value={limit}
                onChange={e => setLimit(e.target.value)}
              />
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <label>
                Month
                <input
                  required
                  type="number"
                  min="1"
                  max="12"
                  value={month}
                  onChange={e => setMonth(e.target.value)}
                />
              </label>
              <label>
                Year
                <input
                  required
                  type="number"
                  min="2020"
                  max="2035"
                  value={year}
                  onChange={e => setYear(e.target.value)}
                />
              </label>
            </div>
            <button className="primary" type="submit">Save Budget</button>
          </form>
        </div>

        <div className="card table">
          <small>TARGETS</small>
          <h3>Active Budgets</h3>
          {loading ? (
            <div className="center">Loading budgets...</div>
          ) : budgets.length ? (
            budgets.map(b => (
              <div className="row" key={b.id}>
                <div>
                  <b>Month {b.month} / {b.year}</b>
                  <small>Monthly Target</small>
                </div>
                <strong>{formatMoney(b.monthlyLimit)}</strong>
              </div>
            ))
          ) : (
            <p className="empty">No budgets set yet.</p>
          )}
        </div>
      </div>
    </>
  );
}

function Reports() {
  const [summary, setSummary] = useState(null);
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/dashboard/summary'), api.get('/transactions')])
      .then(([sRes, tRes]) => {
        setSummary(sRes.data);
        setTxs(tRes.data || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="center">Loading financial reports...</div>;

  const incomeTxs = txs.filter(t => t.type === 'INCOME');
  const expenseTxs = txs.filter(t => t.type === 'EXPENSE');

  return (
    <>
      <div className="page">
        <div>
          <small>ANALYTICS</small>
          <h1>Financial Reports</h1>
        </div>
      </div>

      <div className="metrics" style={{ marginBottom: '25px' }}>
        <div className="card metric">
          <small>TOTAL INFLOW</small>
          <strong className="green">{formatMoney(summary?.totalIncome)}</strong>
          <span>{incomeTxs.length} transactions</span>
        </div>
        <div className="card metric">
          <small>TOTAL OUTFLOW</small>
          <strong className="red">{formatMoney(summary?.totalExpenses)}</strong>
          <span>{expenseTxs.length} transactions</span>
        </div>
        <div className="card metric">
          <small>NET BALANCE</small>
          <strong>{formatMoney(summary?.currentBalance)}</strong>
          <span>Current month</span>
        </div>
        <div className="card metric">
          <small>SAVINGS RATE</small>
          <strong className="green">
            {summary?.totalIncome > 0
              ? `${Math.max(0, Math.round(((summary.totalIncome - summary.totalExpenses) / summary.totalIncome) * 100))}%`
              : '0%'}
          </strong>
          <span>Of monthly income</span>
        </div>
      </div>

      <div className="card">
        <small>SUMMARY BREAKDOWN</small>
        <h3>Cash Flow Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '15px' }}>
          <div style={{ padding: '16px', background: '#fcfcfa', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '12px', color: '#73817c' }}>Total Recorded Transactions</span>
            <h2 style={{ margin: '8px 0 0', fontSize: '28px' }}>{txs.length}</h2>
          </div>
          <div style={{ padding: '16px', background: '#fcfcfa', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '12px', color: '#73817c' }}>Income Entries</span>
            <h2 style={{ margin: '8px 0 0', fontSize: '28px', color: '#0f8f78' }}>{incomeTxs.length}</h2>
          </div>
          <div style={{ padding: '16px', background: '#fcfcfa', borderRadius: '10px', border: '1px solid #edf0e9' }}>
            <span style={{ fontSize: '12px', color: '#73817c' }}>Expense Entries</span>
            <h2 style={{ margin: '8px 0 0', fontSize: '28px', color: '#d95e42' }}>{expenseTxs.length}</h2>
          </div>
        </div>
      </div>
    </>
  );
}

function Profile() {
  const { user, logout } = useAuth();
  const nav = useNavigate();

  return (
    <>
      <div className="page">
        <div>
          <small>ACCOUNT</small>
          <h1>Profile</h1>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '24px' }}>
          <b className="avatar" style={{ width: '56px', height: '56px', fontSize: '24px' }}>
            {user?.fullName?.[0]?.toUpperCase()}
          </b>
          <div>
            <h2 style={{ margin: '0 0 4px' }}>{user?.fullName}</h2>
            <small style={{ color: '#73817c', fontSize: '14px' }}>{user?.email}</small>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '12px', borderTop: '1px solid #edf0e9', paddingTop: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#73817c' }}>User ID</span>
            <b>#{user?.id}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#73817c' }}>Email Address</span>
            <b>{user?.email}</b>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#73817c' }}>Account Security</span>
            <span style={{ color: '#0f8f78', fontWeight: 600 }}>BCrypt Encrypted</span>
          </div>
        </div>

        <div style={{ marginTop: '24px' }}>
          <button
            className="button"
            style={{ background: '#f6d5c8', color: '#b63d2e', width: '100%', justifyContent: 'center' }}
            onClick={() => { logout(); nav('/login'); }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </>
  );
}

function Settings() {
  return (
    <>
      <div className="page">
        <div>
          <small>PREFERENCES</small>
          <h1>Settings</h1>
        </div>
      </div>

      <div className="card" style={{ maxWidth: '600px' }}>
        <small>APPLICATION</small>
        <h3>System Preferences</h3>
        <div style={{ display: 'grid', gap: '16px', marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>Default Currency</b>
              <small style={{ display: 'block', color: '#73817c' }}>Indian Rupee (INR - ₹)</small>
            </div>
            <span style={{ padding: '6px 12px', background: '#e6f5df', color: '#0f8f78', borderRadius: '6px', fontWeight: 700 }}>
              INR (₹)
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>Backend API Server</b>
              <small style={{ display: 'block', color: '#73817c' }}>http://localhost:8080/api</small>
            </div>
            <span style={{ padding: '6px 12px', background: '#e6f5df', color: '#0f8f78', borderRadius: '6px', fontWeight: 700 }}>
              Connected
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <b>Database Engine</b>
              <small style={{ display: 'block', color: '#73817c' }}>MySQL 8.0 (personal_expense_management)</small>
            </div>
            <span style={{ padding: '6px 12px', background: '#e6f5df', color: '#0f8f78', borderRadius: '6px', fontWeight: 700 }}>
              Active
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function App() {
  return (
    <Provider>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/register" element={<Auth reg />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route
          path="*"
          element={
            <Guard>
              <Shell>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/income" element={<Entry key="income" type="income" />} />
                  <Route path="/expense" element={<Entry key="expense" type="expense" />} />
                  <Route path="/budgets" element={<Budgets />} />
                  <Route path="/categories" element={<Categories />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Shell>
            </Guard>
          }
        />
      </Routes>
    </Provider>
  );
}

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
