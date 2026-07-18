import React, { useState, useEffect, useRef } from 'react';
import {
  Edit3,
  Calendar,
  Minus,
  Loader2,
  Utensils,
  Sun,
  Sunset,
  Briefcase,
  Home,
  Plane,
  RefreshCw,
  Cloud,
  CloudOff,
  Award,
  Sparkles,
  AlertCircle,
  Activity,
  Heart,
  Settings,
  Trash2,
  User,
  Mail,
  Lock,
  LogOut,
  LogIn,
  UserPlus,
  Moon,
  Footprints
} from 'lucide-react';

const CORE_GOALS = [
  { id: 'sleep', label: '6+ Hours of Sleep', icon: <Moon size={18} className="text-indigo-400" /> },
  { id: 'steps', label: '6k+ Steps', icon: <Footprints size={18} className="text-emerald-400" /> }
];

const WALK_TASKS = [
  { id: 'walk_morning', label: 'Morning Walk', icon: <Sun size={16} className="text-amber-500" /> },
  { id: 'walk_afternoon', label: 'Afternoon Walk', icon: <Sun size={16} className="text-orange-500" /> },
  { id: 'walk_evening', label: 'Evening Walk', icon: <Sunset size={16} className="text-indigo-400" /> }
];

const MEAL_TASKS = [
  { id: 'meal_breakfast', label: 'Breakfast' },
  { id: 'meal_lunch', label: 'Lunch' },
  { id: 'meal_dinner', label: 'Dinner' }
];

const formatDateString = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - offset * 60 * 1000);
  return localDate.toISOString().split('T')[0];
};

const getEnv = (key) => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return import.meta.env[key];
    }
  } catch (e) {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}
  return '';
};

// Project connection details come from build-time env vars only.
// The anon key is meant to be public — real protection comes from
// Row Level Security policies on the habit_logs table (see the
// migration SQL shared alongside this file), not from hiding this key.
const SUPABASE_URL = getEnv('VITE_SUPABASE_URL') || getEnv('REACT_APP_SUPABASE_URL');
const SUPABASE_ANON_KEY = getEnv('VITE_SUPABASE_ANON_KEY') || getEnv('REACT_APP_SUPABASE_ANON_KEY');

const loadSupabaseLibrary = async () => {
  return new Promise((resolve, reject) => {
    if (window.supabase) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Supabase SDK CDN.'));
    document.head.appendChild(script);
  });
};

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [selectedDate, setSelectedDate] = useState(formatDateString(new Date()));
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [configError, setConfigError] = useState(false);

  // Auth state
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' | 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authNotice, setAuthNotice] = useState('');

  const [loading, setLoading] = useState(true);
  const [allLogs, setAllLogs] = useState({});
  const [journalText, setJournalText] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  const [toast, setToast] = useState(null);

  const journalDebounceTimeout = useRef(null);
  const todayStr = formatDateString(new Date());

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const cacheKey = (userId) => `habitflow_cache_${userId}`;

  // --- Boot: load Supabase SDK + client, then watch auth state ---
  useEffect(() => {
    let unsubscribe = () => {};

    const init = async () => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setConfigError(true);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      try {
        await loadSupabaseLibrary();
        const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        setSupabaseClient(client);

        const { data: { session: currentSession } } = await client.auth.getSession();
        setSession(currentSession);
        setAuthChecked(true);

        if (currentSession) {
          await fetchAllLogsFromSupabase(client, currentSession.user.id);
        } else {
          setLoading(false);
        }

        const { data: listener } = client.auth.onAuthStateChange((_event, newSession) => {
          setSession(newSession);
          if (newSession) {
            fetchAllLogsFromSupabase(client, newSession.user.id);
          } else {
            setAllLogs({});
            setLoading(false);
          }
        });
        unsubscribe = () => listener.subscription.unsubscribe();
      } catch (err) {
        console.error('Supabase init failed:', err);
        setConfigError(true);
        setAuthChecked(true);
        setLoading(false);
      }
    };

    init();
    return () => unsubscribe();
  }, []);

  const fetchAllLogsFromSupabase = async (client, userId) => {
    setLoading(true);
    try {
      const { data, error } = await client
        .from('habit_logs')
        .select('date, habit_id, status')
        .eq('user_id', userId);

      if (error) throw error;

      const compiled = {};
      (data || []).forEach((row) => {
        if (!compiled[row.date]) compiled[row.date] = {};
        compiled[row.date][row.habit_id] = row.status;
      });

      setAllLogs(compiled);
      localStorage.setItem(cacheKey(userId), JSON.stringify(compiled));
      setLoading(false);
    } catch (err) {
      console.error('Failed to fetch records:', err);
      showToast('Could not reach the database. Showing your last saved copy.', 'error');
      try {
        const cached = localStorage.getItem(cacheKey(userId));
        if (cached) setAllLogs(JSON.parse(cached));
      } catch (e) {}
      setLoading(false);
    }
  };

  // --- Auth actions ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (!supabaseClient) return;
    setAuthError('');
    setAuthNotice('');

    if (!authEmail.trim() || !authPassword) {
      setAuthError('Enter both an email and a password.');
      return;
    }
    if (authMode === 'signup' && authPassword.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading(true);
    try {
      if (authMode === 'signup') {
        const { error } = await supabaseClient.auth.signUp({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        setAuthNotice('Account created. Check your email to confirm, then sign in.');
        setAuthMode('signin');
      } else {
        const { error } = await supabaseClient.auth.signInWithPassword({
          email: authEmail.trim(),
          password: authPassword
        });
        if (error) throw error;
        setAuthPassword('');
      }
    } catch (err) {
      setAuthError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!supabaseClient) return;
    await supabaseClient.auth.signOut();
    setActiveTab('input');
    showToast('Signed out.', 'info');
  };

  useEffect(() => {
    setJournalText(allLogs[selectedDate]?.journal_entry || '');
  }, [selectedDate, allLogs]);

  const updateSingleField = async (dateKey, fieldName, fieldValue) => {
    if (!session) return;
    const userId = session.user.id;
    const dayData = allLogs[dateKey] || {};
    const updatedDay = { ...dayData, [fieldName]: fieldValue };

    setAllLogs((prev) => {
      const copy = { ...prev, [dateKey]: updatedDay };
      localStorage.setItem(cacheKey(userId), JSON.stringify(copy));
      return copy;
    });

    if (!supabaseClient) return;

    try {
      const { error } = await supabaseClient
        .from('habit_logs')
        .upsert(
          { user_id: userId, date: dateKey, habit_id: fieldName, status: fieldValue },
          { onConflict: 'user_id,date,habit_id' }
        );
      if (error) throw error;
    } catch (err) {
      console.error('Sync failed:', err);
      showToast('Sync delay. Saved locally, will retry.', 'error');
    }
  };

  const handleJournalChange = (text) => {
    setJournalText(text);
    setSavingJournal(true);
    if (journalDebounceTimeout.current) clearTimeout(journalDebounceTimeout.current);
    journalDebounceTimeout.current = setTimeout(() => {
      updateSingleField(selectedDate, 'journal_entry', text).then(() => setSavingJournal(false));
    }, 1000);
  };

  const injectDemoData = async () => {
    if (!session) return;
    const userId = session.user.id;
    const demoLogs = { ...allLogs };
    const mockReflections = [
      'Productive office day! Took walking breaks during sync calls.',
      'A bit sluggish in the afternoon, skipped the afternoon step goal but compensated later.',
      'Had a wonderful home cooked dinner with family. Slept peacefully.',
      'Travelled today, steps were high but sleep suffered a bit due to late arrival.',
      'Felt energized today. Achieved both outcome checkpoints!',
      'Lazy Sunday. Spent time reading. Cooked a big batch of breakfast.',
      'Focus was heavily on deadlines. Walked in the evening to clear my head.'
    ];

    for (let i = 15; i >= 0; i--) {
      const tempDate = new Date();
      tempDate.setDate(tempDate.getDate() - i);
      const dateKey = formatDateString(tempDate);
      const isWeekend = tempDate.getDay() === 0 || tempDate.getDay() === 6;
      const context = isWeekend ? 'home' : Math.random() > 0.4 ? 'office' : 'home';

      demoLogs[dateKey] = {
        day_context: context,
        sleep: Math.random() > 0.25 ? 'yes' : 'no',
        steps: Math.random() > 0.3 ? 'yes' : 'no',
        walk_morning: Math.random() > 0.5 ? 'yes' : 'no',
        walk_afternoon: Math.random() > 0.4 ? 'yes' : 'na',
        walk_evening: Math.random() > 0.3 ? 'yes' : 'no',
        meal_breakfast: Math.random() > 0.3 ? 'cooked' : 'skipped',
        meal_lunch: context === 'office' ? (Math.random() > 0.5 ? 'ordered' : 'ate_out') : 'cooked',
        meal_dinner: Math.random() > 0.4 ? 'cooked' : 'ordered',
        journal_entry: mockReflections[Math.floor(Math.random() * mockReflections.length)]
      };
    }

    setAllLogs(demoLogs);
    localStorage.setItem(cacheKey(userId), JSON.stringify(demoLogs));
    showToast('Sample data loaded into your account.', 'success');

    if (supabaseClient) {
      for (const [dateKey, habits] of Object.entries(demoLogs)) {
        for (const [habit_id, status] of Object.entries(habits)) {
          await supabaseClient
            .from('habit_logs')
            .upsert({ user_id: userId, date: dateKey, habit_id, status }, { onConflict: 'user_id,date,habit_id' });
        }
      }
    }
  };

  const purgeLogs = async () => {
    if (!session) return;
    if (!window.confirm('Delete all of your logs? This only affects your own account.')) return;
    const userId = session.user.id;

    setAllLogs({});
    localStorage.removeItem(cacheKey(userId));

    if (supabaseClient) {
      try {
        const { error } = await supabaseClient.from('habit_logs').delete().eq('user_id', userId);
        if (error) throw error;
      } catch (err) {
        console.error('Purge failed:', err);
        showToast('Local logs cleared, but the cloud copy failed to delete.', 'error');
        return;
      }
    }
    showToast('All your logs were deleted.', 'info');
  };

  const activeLogs = allLogs[selectedDate] || {};
  const currentContext = activeLogs.day_context || 'home';

  const calculateDailyProgress = (dateStr) => {
    const targetLogs = allLogs[dateStr] || {};
    let matched = 0;
    CORE_GOALS.forEach((g) => {
      if (targetLogs[g.id] === 'yes') matched++;
    });
    return { completed: matched, total: CORE_GOALS.length, pct: matched ? Math.round((matched / CORE_GOALS.length) * 100) : 0 };
  };

  const getWeeklyAverage = () => {
    let totals = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      totals += calculateDailyProgress(formatDateString(d)).pct;
    }
    return Math.round(totals / 7);
  };

  const getRollingBlockAverage = (blockNum) => {
    let accumulated = 0;
    const offsetStart = blockNum * 21;
    for (let i = 0; i < 21; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (offsetStart + i));
      accumulated += calculateDailyProgress(formatDateString(d)).pct;
    }
    return Math.round(accumulated / 21);
  };

  const dateStrip = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateStrip.push({
      key: formatDateString(d),
      label: i === 0 ? 'TODAY' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    });
  }

  // --- Config error screen (missing env vars) ---
  if (configError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 flex-col gap-4 text-white px-6 text-center">
        <AlertCircle className="text-red-400 w-10 h-10" />
        <p className="text-sm font-bold text-slate-300">Database not configured</p>
        <p className="text-xs text-slate-500 max-w-sm">
          This deployment is missing its Supabase connection details. Set VITE_SUPABASE_URL and
          VITE_SUPABASE_ANON_KEY as environment variables at build time.
        </p>
      </div>
    );
  }

  // --- Auth gate ---
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 flex-col gap-4 text-white">
        <Loader2 className="animate-spin text-indigo-500 w-10 h-10" />
        <p className="text-sm font-medium text-slate-400">Loading HabitFlow...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 font-sans text-slate-200">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-1.5">
            <div className="w-10 h-10 mx-auto rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-extrabold text-lg">
              H
            </div>
            <h1 className="text-xl font-black tracking-tight text-white">HabitFlow</h1>
            <p className="text-xs text-slate-500">Your habits, your account, only you can see them.</p>
          </div>

          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 shadow-xl space-y-4">
            <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800">
              <button
                onClick={() => { setAuthMode('signin'); setAuthError(''); setAuthNotice(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${authMode === 'signin' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setAuthMode('signup'); setAuthError(''); setAuthNotice(''); }}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${authMode === 'signup' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Mail size={13} /> Email
                </label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full text-xs p-3 border border-slate-800 rounded-xl bg-slate-900/50 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 flex items-center gap-1.5">
                  <Lock size={13} /> Password
                </label>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full text-xs p-3 border border-slate-800 rounded-xl bg-slate-900/50 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                />
              </div>

              {authError && (
                <p className="text-[11px] text-red-400 font-semibold">{authError}</p>
              )}
              {authNotice && (
                <p className="text-[11px] text-emerald-400 font-semibold">{authNotice}</p>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                {authLoading ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : authMode === 'signup' ? (
                  <UserPlus size={14} />
                ) : (
                  <LogIn size={14} />
                )}
                {authMode === 'signup' ? 'Create Account' : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="text-center text-[10px] text-slate-600">
            Each account only ever sees its own logs.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 flex-col gap-4 text-white">
        <Loader2 className="animate-spin text-indigo-500 w-12 h-12" />
        <p className="text-sm font-medium text-slate-400">Loading your logs...</p>
      </div>
    );
  }

  const todayProgress = calculateDailyProgress(selectedDate);
  const hasAnyLogs = Object.keys(allLogs).length > 0;

  return (
    <div className="min-h-screen bg-slate-950 pb-28 font-sans text-slate-200 antialiased selection:bg-indigo-500 selection:text-white">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border text-xs font-bold transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/30' :
          toast.type === 'error' ? 'bg-red-950/90 text-red-300 border-red-500/30' :
          'bg-slate-900/95 text-slate-300 border-slate-700/50'
        }`}>
          <Sparkles size={14} className="text-amber-400" />
          <span>{toast.message}</span>
        </div>
      )}

      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white font-extrabold text-lg">
            H
          </div>
          <h1 className="text-lg font-black tracking-tight text-white">HabitFlow</h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border bg-emerald-950/50 text-emerald-400 border-emerald-800/30">
          <Cloud size={14} />
          <span className="text-[10px] tracking-wide">Synced</span>
        </span>
      </header>

      <main className="mx-auto max-w-xl p-4 space-y-6">
        {activeTab === 'input' && (
          <div className="space-y-5">
            {!hasAnyLogs && (
              <section className="rounded-2xl border border-indigo-900/40 bg-indigo-950/20 p-4 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-300">No logs yet. Want to explore with sample data first?</p>
                <button
                  onClick={injectDemoData}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1 flex-shrink-0"
                >
                  <Sparkles size={11} /> Load sample data
                </button>
              </section>
            )}

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 shadow-xl relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <h2 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Daily Overview</h2>
                  <h3 className="text-xl font-extrabold text-white">Progress</h3>
                </div>
                <div className="bg-indigo-950/50 border border-indigo-800/50 rounded-xl px-2.5 py-1 text-right">
                  <span className="text-[10px] text-indigo-300 font-bold uppercase block">Weekly Avg</span>
                  <span className="text-base font-black text-indigo-400">{getWeeklyAverage()}%</span>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row items-center gap-6">
                <div className="relative flex items-center justify-center w-24 h-24 flex-shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="48" cy="48" r="40" className="stroke-slate-800" strokeWidth="8" fill="transparent" />
                    <circle
                      cx="48" cy="48" r="40"
                      className="stroke-indigo-500 transition-all duration-700 ease-out"
                      strokeWidth="8" fill="transparent"
                      strokeDasharray={2 * Math.PI * 40}
                      strokeDashoffset={2 * Math.PI * 40 * (1 - todayProgress.pct / 100)}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-xl font-black text-white">{todayProgress.pct}%</span>
                    <span className="text-[9px] font-bold text-slate-400 tracking-wider">TODAY</span>
                  </div>
                </div>

                <div className="flex-1 space-y-3 w-full">
                  <div className="flex justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5"><Activity size={12} className="text-indigo-400" /> Goals Met</span>
                    <span className="text-white font-extrabold">{todayProgress.completed} of {todayProgress.total}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden border border-slate-700/30">
                    <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 transition-all duration-500 ease-out" style={{ width: `${todayProgress.pct}%` }} />
                  </div>
                </div>
              </div>

              <div className="mt-6 border-t border-slate-800/80 pt-4">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">3-Week Trend</span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-xl bg-slate-900/50 p-2.5 border border-slate-800/80">
                    <span className="block text-slate-500 text-[9px] uppercase font-bold">Wks 7-9</span>
                    <span className="font-extrabold text-slate-300 text-sm mt-0.5 block">{getRollingBlockAverage(2)}%</span>
                  </div>
                  <div className="rounded-xl bg-slate-900/50 p-2.5 border border-slate-800/80">
                    <span className="block text-slate-500 text-[9px] uppercase font-bold">Wks 4-6</span>
                    <span className="font-extrabold text-slate-300 text-sm mt-0.5 block">{getRollingBlockAverage(1)}%</span>
                  </div>
                  <div className="rounded-xl bg-indigo-950/30 p-2.5 border border-indigo-500/20">
                    <span className="block text-indigo-400 text-[9px] uppercase font-black">Current</span>
                    <span className="font-black text-indigo-300 text-sm mt-0.5 block">{getRollingBlockAverage(0)}%</span>
                  </div>
                </div>
              </div>
            </section>

            <section className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/40 p-2.5 border border-slate-800/80 rounded-2xl shadow-md">
              <div className="flex gap-1">
                {dateStrip.map((d) => (
                  <button
                    key={d.key}
                    onClick={() => setSelectedDate(d.key)}
                    className={`flex-1 px-3.5 py-2 text-xs font-bold rounded-xl transition-all duration-200 ${
                      selectedDate === d.key ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between sm:justify-end gap-2 sm:pl-3 border-t sm:border-t-0 sm:border-l border-slate-800 pt-2.5 sm:pt-0">
                <input
                  type="date"
                  max={todayStr}
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="p-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 w-full sm:w-auto"
                />
                {selectedDate !== todayStr && (
                  <button onClick={() => setSelectedDate(todayStr)} className="p-2 text-xs text-indigo-400 hover:bg-indigo-950/50 rounded-xl font-bold flex items-center gap-1 transition-all">
                    <RefreshCw size={13} /> Today
                  </button>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 shadow-md space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Day Context</h3>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => updateSingleField(selectedDate, 'day_context', 'home')} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border transition-all ${currentContext === 'home' ? 'bg-amber-500/10 text-amber-300 border-amber-500/40' : 'bg-slate-900 text-slate-400 border-slate-800/80 hover:bg-slate-800'}`}>
                  <Home size={16} />
                  <span className="text-[10px] font-bold uppercase">Home</span>
                </button>
                <button onClick={() => updateSingleField(selectedDate, 'day_context', 'office')} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border transition-all ${currentContext === 'office' ? 'bg-blue-500/10 text-blue-300 border-blue-500/40' : 'bg-slate-900 text-slate-400 border-slate-800/80 hover:bg-slate-800'}`}>
                  <Briefcase size={16} />
                  <span className="text-[10px] font-bold uppercase">Office</span>
                </button>
                <button onClick={() => updateSingleField(selectedDate, 'day_context', 'travel')} className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl border transition-all ${currentContext === 'travel' ? 'bg-purple-500/10 text-purple-300 border-purple-500/40' : 'bg-slate-900 text-slate-400 border-slate-800/80 hover:bg-slate-800'}`}>
                  <Plane size={16} />
                  <span className="text-[10px] font-bold uppercase">Travel</span>
                </button>
              </div>
            </section>

            <section className="space-y-2.5">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 px-1">Core Outcome Goals</h3>
              {CORE_GOALS.map((goal) => {
                const status = activeLogs[goal.id] || 'empty';
                return (
                  <div key={goal.id} className="flex items-center justify-between rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 shadow-md">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center border border-slate-800">{goal.icon}</div>
                      <span className="font-extrabold text-white text-sm tracking-wide">{goal.label}</span>
                    </div>
                    <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
                      <button onClick={() => updateSingleField(selectedDate, goal.id, 'yes')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === 'yes' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>YES</button>
                      <button onClick={() => updateSingleField(selectedDate, goal.id, 'no')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === 'no' ? 'bg-red-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}>NO</button>
                    </div>
                  </div>
                );
              })}
            </section>

            <section className="space-y-4">
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 px-1 border-t border-slate-900 pt-4">Behavioral Context</h3>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 shadow-md space-y-3.5">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wide border-b border-slate-800/80 pb-2">Walks</h4>
                <div className="space-y-3">
                  {WALK_TASKS.map((task) => {
                    const status = activeLogs[task.id] || 'empty';
                    return (
                      <div key={task.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-300 font-bold">{task.icon}{task.label}</div>
                        <div className="flex bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px] font-black">
                          {['yes', 'no', 'na'].map((state) => (
                            <button
                              key={state}
                              onClick={() => updateSingleField(selectedDate, task.id, state)}
                              className={`px-2.5 py-1 uppercase rounded-md ${
                                status === state
                                  ? state === 'yes' ? 'bg-emerald-600 text-white' : state === 'no' ? 'bg-red-600 text-white' : 'bg-slate-600 text-white'
                                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                              }`}
                            >
                              {state === 'na' ? 'N/A' : state}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 shadow-md space-y-4">
                <h4 className="text-xs font-black text-slate-300 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-800/80 pb-2">
                  <Utensils size={14} className="text-indigo-400" /> Meals
                </h4>
                <div className="space-y-4">
                  {MEAL_TASKS.map((task) => {
                    const status = activeLogs[task.id] || 'empty';
                    return (
                      <div key={task.id} className="flex flex-col gap-2 pb-3 border-b border-dashed border-slate-800 last:border-0 last:pb-0">
                        <span className="text-xs font-bold text-slate-300 pl-1">{task.label}</span>
                        <div className="grid grid-cols-4 gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[9px] font-black text-center">
                          {[
                            { key: 'cooked', label: 'COOK' },
                            { key: 'ordered', label: 'ORDER' },
                            { key: 'ate_out', label: 'OUT' },
                            { key: 'skipped', label: 'SKIP' }
                          ].map((opt) => (
                            <button
                              key={opt.key}
                              onClick={() => updateSingleField(selectedDate, task.id, opt.key)}
                              className={`py-1.5 rounded-lg transition-all uppercase ${
                                status === opt.key
                                  ? opt.key === 'cooked' ? 'bg-emerald-600 text-white shadow-md' :
                                    opt.key === 'ordered' ? 'bg-blue-600 text-white shadow-md' :
                                    opt.key === 'ate_out' ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-600 text-white shadow-md'
                                  : 'text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 shadow-md space-y-3">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2">
                <h3 className="text-xs font-black uppercase tracking-wide text-slate-300 flex items-center gap-1.5">
                  <Heart size={14} className="text-red-500" /> Reflections
                </h3>
                <span className="text-[10px] font-bold text-slate-500">{savingJournal ? 'Saving…' : 'Synced'}</span>
              </div>
              <textarea
                value={journalText}
                onChange={(e) => handleJournalChange(e.target.value)}
                placeholder="How did today go?"
                rows={3}
                className="w-full text-xs p-3.5 border border-slate-800 rounded-xl bg-slate-900/50 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-medium leading-relaxed"
              />
            </section>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 shadow-xl space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-base font-extrabold text-white">History</h2>
                <p className="text-xs text-slate-400 mt-0.5">Your past days, most recent first.</p>
              </div>
              {hasAnyLogs && (
                <button onClick={purgeLogs} className="p-2 text-xs text-red-400 hover:bg-red-950/20 rounded-xl font-bold flex items-center gap-1 border border-transparent hover:border-red-900/20">
                  <Trash2 size={13} /> Clear
                </button>
              )}
            </div>

            <div className="space-y-4 divide-y divide-slate-800/60">
              {!hasAnyLogs ? (
                <div className="text-center py-12 space-y-3">
                  <Award className="mx-auto text-slate-600 w-12 h-12 stroke-1" />
                  <p className="text-xs text-slate-500 font-bold">No logs yet.</p>
                  <button onClick={injectDemoData} className="mx-auto text-xs px-3.5 py-2 rounded-xl bg-indigo-950/40 hover:bg-indigo-900/50 text-indigo-300 border border-indigo-900/30 font-bold flex items-center gap-1.5 transition-all">
                    <Sparkles size={13} /> Load sample data
                  </button>
                </div>
              ) : (
                Object.keys(allLogs).sort((a, b) => b.localeCompare(a)).map((dateKey) => {
                  const dayData = allLogs[dateKey];
                  const dailyProgress = calculateDailyProgress(dateKey);
                  return (
                    <div key={dateKey} className="pt-4 first:pt-0 text-xs space-y-2">
                      <div className="flex justify-between items-center font-bold text-slate-300">
                        <span className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-indigo-400" />
                          {dateKey}
                          <span className="font-semibold text-xs text-slate-500 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md capitalize">{dayData.day_context || 'home'}</span>
                        </span>
                        <span className="text-indigo-400 font-black">{dailyProgress.pct}%</span>
                      </div>
                      {dayData.journal_entry && (
                        <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 border-dashed text-slate-400 font-medium italic leading-relaxed">
                          "{dayData.journal_entry}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="rounded-2xl border border-slate-800/80 bg-slate-900/30 p-5 shadow-xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Settings size={18} className="text-indigo-400" /> Account
              </h2>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                <User size={14} className="text-indigo-400" /> {session.user.email}
              </div>
              <p className="text-[11px] text-slate-500">
                Only you can see your logs — every account's data is isolated by the database's access rules, not by anything in this app's code.
              </p>
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 bg-red-950/40 hover:bg-red-950/70 text-red-400 border border-red-900/30 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <LogOut size={14} /> Sign Out
              </button>
            </div>
          </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800/80 bg-slate-900/90 backdrop-blur-md px-4 py-3">
        <div className="mx-auto max-w-xl flex justify-around">
          <button onClick={() => setActiveTab('input')} className={`flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-bold transition-all rounded-xl ${activeTab === 'input' ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-400 hover:text-slate-200'}`}>
            <Edit3 size={18} />
            <span>Tracker</span>
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-bold transition-all rounded-xl ${activeTab === 'history' ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-400 hover:text-slate-200'}`}>
            <Calendar size={18} />
            <span>History</span>
          </button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 px-3 py-1.5 text-[10px] font-bold transition-all rounded-xl ${activeTab === 'settings' ? 'text-indigo-400 bg-indigo-950/40' : 'text-slate-400 hover:text-slate-200'}`}>
            <Settings size={18} />
            <span>Account</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
