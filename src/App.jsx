import React, { useState, useEffect } from 'react';
import { 
  Check, 
  X, 
  Minus, 
  Edit3, 
  Calendar, 
  BarChart3, 
  Loader2, 
  ChevronLeft, 
  ChevronRight,
  Database,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Award
} from 'lucide-react';

const MY_HABITS = [
  { id: 'sleep', label: '6+ hours of sleep', type: 'simple' },
  { 
    id: 'walks', 
    label: 'Walks', 
    type: 'group', 
    children: [
      { id: 'walk_morning', label: 'Morning Walk' },
      { id: 'walk_afternoon', label: 'Afternoon Walk' },
      { id: 'walk_evening', label: 'Evening Walk' }
    ] 
  },
  { id: 'steps', label: '6k+ steps', type: 'simple' },
  { 
    id: 'meals', 
    label: 'Meals Cooked At Home', 
    type: 'group', 
    children: [
      { id: 'meal_breakfast', label: 'Breakfast cooked' },
      { id: 'meal_lunch', label: 'Lunch cooked' },
      { id: 'meal_dinner', label: 'Dinner cooked' }
    ] 
  }
];

// Flat list helper for quick queries and analytics
const getAllHabitIds = (habits) => {
  let ids = [];
  habits.forEach(h => {
    if (h.type === 'group') {
      h.children.forEach(c => ids.push({ id: c.id, label: c.label }));
    } else {
      ids.push({ id: h.id, label: h.label });
    }
  });
  return ids;
};

const HABIT_FLAT_LIST = getAllHabitIds(MY_HABITS);

// -------------------------------------------------------------
// SUPABASE CLIENT INITIALIZATION CONFIGURATION
// Replace these with your actual Supabase dashboard credentials!
// -------------------------------------------------------------
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [supabaseClient, setSupabaseClient] = useState(null);
  const [dbStatus, setDbStatus] = useState('initializing'); // 'initializing', 'local-demo', 'connected'
  
  // Format dates consistently as 'YYYY-MM-DD'
  const getTodayDateString = () => {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
  };

  const [selectedDate, setSelectedDate] = useState(getTodayDateString());
  const [data, setData] = useState({}); // Stores key format: { 'YYYY-MM-DD_habitId': 'yes' | 'no' | 'na' | 'empty' }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSupabaseLibrary = async () => {
      try {
        // If already loaded in window
        if (window.supabase) {
          initializeClient();
          return;
        }

        // Programmatically inject Supabase UMD library script from secure CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js';
        script.async = true;
        script.onload = () => {
          initializeClient();
        };
        script.onerror = () => {
          console.warn("Supabase CDN script failed to load. Defaulting to local Storage mode.");
          setDbStatus('local-demo');
          loadLocalFallback();
        };
        document.head.appendChild(script);
      } catch (err) {
        console.error("Dynamic script load error: ", err);
        setDbStatus('local-demo');
        loadLocalFallback();
      }
    };

    const initializeClient = () => {
      // Validate credentials
      if (
        !SUPABASE_URL || 
        SUPABASE_URL === 'YOUR_SUPABASE_URL' || 
        !SUPABASE_KEY || 
        SUPABASE_KEY === 'YOUR_SUPABASE_ANON_KEY'
      ) {
        console.warn("Using local Storage fallback. Enter your valid Supabase Credentials in App.jsx to enable Syncing.");
        setDbStatus('local-demo');
        loadLocalFallback();
        return;
      }

      try {
        if (window.supabase) {
          const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
          setSupabaseClient(client);
          setDbStatus('connected');
          fetchDatabaseLogs(client);
        } else {
          setDbStatus('local-demo');
          loadLocalFallback();
        }
      } catch (error) {
        console.error("Failed to build Supabase Client instance: ", error);
        setDbStatus('local-demo');
        loadLocalFallback();
      }
    };

    loadSupabaseLibrary();
  }, []);

  const loadLocalFallback = () => {
    try {
      const cached = localStorage.getItem('habitflow_cache');
      if (cached) {
        setData(JSON.parse(cached));
      }
    } catch (e) {
      console.error("Error reading cache: ", e);
    }
    setLoading(false);
  };

  const fetchDatabaseLogs = async (clientInstance) => {
    try {
      const { data: logs, error } = await clientInstance
        .from('habit_logs')
        .select('*');

      if (error) throw error;

      if (logs) {
        // Remap to app structure { `${date}_${habit_id}`: status }
        const mappedData = {};
        logs.forEach(log => {
          mappedData[`${log.date}_${log.habit_id}`] = log.status;
        });
        setData(mappedData);
        // Sync local storage as well for fast load times later
        localStorage.setItem('habitflow_cache', JSON.stringify(mappedData));
      }
    } catch (err) {
      console.error("Database fetch failed. Using local cache instead: ", err);
      loadLocalFallback();
    } finally {
      setLoading(false);
    }
  };

  const toggleHabit = async (habitId) => {
    const stateKey = `${selectedDate}_${habitId}`;
    const currentStatus = data[stateKey] || 'empty';
    
    // Cycle: empty -> yes -> no -> na -> empty
    let nextStatus = 'empty';
    if (currentStatus === 'empty') nextStatus = 'yes';
    else if (currentStatus === 'yes') nextStatus = 'no';
    else if (currentStatus === 'no') nextStatus = 'na';

    // Update state instantly for fluid UX (Optimistic State Update)
    const updatedData = { ...data, [stateKey]: nextStatus };
    setData(updatedData);
    localStorage.setItem('habitflow_cache', JSON.stringify(updatedData));

    // Save changes downstream to database if active
    if (dbStatus === 'connected' && supabaseClient) {
      try {
        const { error } = await supabaseClient
          .from('habit_logs')
          .upsert({
            habit_id: habitId,
            date: selectedDate,
            status: nextStatus
          }, { onConflict: 'habit_id,date' });

        if (error) {
          console.warn("Could not save to Supabase database. Double-check your RLS policies or schemas.", error);
        }
      } catch (err) {
        console.error("Supabase upsert error: ", err);
      }
    }
  };

  // Move Selected Date forward or backward
  const offsetDate = (days) => {
    const current = new Date(selectedDate + 'T00:00:00');
    current.setDate(current.getDate() + days);
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${current.getFullYear()}-${month}-${day}`);
  };

  // Helper to format date display headers
  const getReadableDateHeader = (dateStr) => {
    const options = { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' };
    const dateObj = new Date(dateStr + 'T00:00:00');
    return dateObj.toLocaleDateString('en-US', options);
  };

  const getQuickPickDates = () => {
    const list = [];
    const centerDate = new Date(selectedDate + 'T00:00:00');
    
    // Generate week viewport centered around selected date
    for (let i = -3; i <= 3; i++) {
      const clone = new Date(centerDate);
      clone.setDate(centerDate.getDate() + i);
      const m = String(clone.getMonth() + 1).padStart(2, '0');
      const d = String(clone.getDate()).padStart(2, '0');
      const key = `${clone.getFullYear()}-${m}-${d}`;
      list.push({
        key,
        dayNum: clone.getDate(),
        weekday: clone.toLocaleDateString('en-US', { weekday: 'narrow' }),
        isToday: key === getTodayDateString()
      });
    }
    return list;
  };

  const renderHabitItem = (habit, depth = 0) => {
    const stateKey = `${selectedDate}_${habit.id}`;
    const status = data[stateKey] || 'empty';

    if (habit.type === 'group') {
      return (
        <div key={habit.id} className="space-y-2 mt-4">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-1">{habit.label}</h3>
          <div className="space-y-2 pl-3 border-l-2 border-slate-100 dark:border-slate-800">
            {habit.children.map(child => renderHabitItem(child, depth + 1))}
          </div>
        </div>
      );
    }

    return (
      <div 
        key={habit.id} 
        className="bg-white p-4 rounded-xl shadow-sm flex justify-between items-center border border-slate-100 transition-all duration-200 hover:border-slate-200"
      >
        <div className="flex flex-col">
          <span className="font-semibold text-slate-800 text-sm md:text-base">{habit.label}</span>
          <span className="text-[11px] text-slate-400">Tap to toggle logs</span>
        </div>

        <button 
          onClick={() => toggleHabit(habit.id)}
          className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center transition-all duration-200 transform active:scale-95 shadow-sm ${
            status === 'empty' ? 'bg-slate-50 border border-dashed border-slate-200 hover:bg-slate-100' :
            status === 'yes' ? 'bg-emerald-500 text-white shadow-emerald-100' :
            status === 'no' ? 'bg-red-500 text-white shadow-red-100' : 
            'bg-slate-400 text-white'
          }`}
          title={`Status: ${status}`}
        >
          {status === 'yes' && <Check size={22} strokeWidth={2.5} />}
          {status === 'no' && <X size={22} strokeWidth={2.5} />}
          {status === 'na' && <Minus size={22} strokeWidth={2.5} />}
          {status === 'empty' && <span className="text-slate-300 font-bold text-base">?</span>}
        </button>
      </div>
    );
  };

  const calculateAnalytics = () => {
    let totals = { yes: 0, no: 0, na: 0, empty: 0 };
    let listCount = 0;

    // We fetch analytics globally for all keys matching selected date
    HABIT_FLAT_LIST.forEach(item => {
      const val = data[`${selectedDate}_${item.id}`] || 'empty';
      totals[val]++;
      listCount++;
    });

    const completed = totals.yes;
    const applicable = listCount - totals.na;
    const rate = applicable > 0 ? Math.round((completed / applicable) * 100) : 0;

    return {
      rate,
      totals,
      applicable
    };
  };

  const currentStats = calculateAnalytics();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
        <Loader2 className="animate-spin text-blue-600 mb-2 w-8 h-8" />
        <span className="text-sm font-medium text-slate-500">Connecting Database logs...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-800 antialiased selection:bg-blue-100">
      
      {/* HEADER BAR */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200/80 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-md shadow-blue-100 text-white font-bold text-lg">
            H
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">HabitFlow</h1>
        </div>

        {/* Sync Indicator Pill */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
          dbStatus === 'connected' 
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
            : 'bg-amber-50 text-amber-700 border border-amber-200'
        }`}>
          <Database size={13} />
          <span>{dbStatus === 'connected' ? 'Cloud Synced' : 'Local Sandbox'}</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* CLOUD CONFIGURATION WARNING (If credentials are missing) */}
        {dbStatus === 'local-demo' && (
          <div className="bg-amber-50/70 border border-amber-100 rounded-xl p-4 text-xs text-amber-800 leading-relaxed space-y-1">
            <div className="font-bold flex items-center gap-1">
              <HelpCircle size={14} /> Cloud Sync Config Pending
            </div>
            <p>
              Your habits are currently storing on your local browser. Paste your valid <strong>SUPABASE_URL</strong> and <strong>SUPABASE_KEY</strong> inside your <code>src/App.jsx</code> file to enable cloud sync.
            </p>
          </div>
        )}

        {}
        <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100/80 space-y-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => offsetDate(-1)}
              className="p-2 rounded-lg hover:bg-slate-50 border border-slate-100 active:scale-95 transition-all text-slate-600"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="text-center">
              <h2 className="font-extrabold text-slate-900 text-base md:text-lg">
                {getReadableDateHeader(selectedDate)}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {selectedDate === getTodayDateString() ? 'Today' : 'Viewing Log Archive'}
              </p>
            </div>

            <button 
              onClick={() => offsetDate(1)}
              className="p-2 rounded-lg hover:bg-slate-50 border border-slate-100 active:scale-95 transition-all text-slate-600"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Quick-Pick week strip */}
          <div className="grid grid-cols-7 gap-2 pt-2 border-t border-slate-50">
            {getQuickPickDates().map((item) => (
              <button
                key={item.key}
                onClick={() => setSelectedDate(item.key)}
                className={`flex flex-col items-center py-2.5 rounded-xl transition-all duration-200 ${
                  selectedDate === item.key
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-100 font-bold scale-105'
                    : 'bg-slate-50/80 hover:bg-slate-100/50 text-slate-600'
                }`}
              >
                <span className="text-[10px] uppercase font-bold opacity-75">{item.weekday}</span>
                <span className="text-sm mt-0.5 font-semibold">{item.dayNum}</span>
                {item.isToday && (
                  <div className={`w-1 h-1 rounded-full mt-1 ${selectedDate === item.key ? 'bg-white' : 'bg-blue-600'}`} />
                )}
              </button>
            ))}
          </div>

          {/* Direct Custom Calendar Date Input Scroller */}
          <div className="flex items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-400">Jump to custom date:</span>
            <input 
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(e.target.value);
                }
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </section>

        {/* TAB INTERFACES */}

        {/* INPUT LOGGING VIEW */}
        {activeTab === 'input' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <h2 className="text-lg font-bold text-slate-900">Today's Goals</h2>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                {currentStats.totals.yes} / {currentStats.applicable} Done
              </span>
            </div>

            <div className="space-y-4">
              {MY_HABITS.map(habit => renderHabitItem(habit))}
            </div>
          </div>
        )}

        {}
        {activeTab === 'recent' && (
          <div className="space-y-5 bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Search Calendar Log</h2>
              <p className="text-xs text-slate-400 mt-1">Select a target date to see what was achieved on that day.</p>
            </div>

            <div className="p-4 bg-slate-50/80 rounded-xl space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase">Selected Archive Date</label>
              <div className="flex gap-2">
                <input 
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700"
                />
              </div>
            </div>

            {/* Quick Summary card for chosen date */}
            <div className="border border-slate-100 rounded-xl p-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">Score for {getReadableDateHeader(selectedDate)}</span>
              <div className="flex items-end justify-between mt-2">
                <span className="text-4xl font-black text-blue-600">{currentStats.rate}%</span>
                <span className="text-sm font-semibold text-slate-500">
                  {currentStats.totals.yes} of {currentStats.applicable} completed
                </span>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
                <div 
                  className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                  style={{ width: `${currentStats.rate}%` }}
                />
              </div>
            </div>

            <button 
              onClick={() => setActiveTab('input')}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
            >
              <Edit3 size={16} />
              Open logging for this day
            </button>
          </div>
        )}

        {/* ANALYTICS STATS VIEW */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            <h2 className="text-lg font-bold text-slate-900 px-1">Global Dashboard</h2>

            {/* General metrics cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Archive completion</span>
                  <span className="text-lg font-bold text-slate-900">{currentStats.rate}%</span>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Award size={20} />
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium block">Logged entries</span>
                  <span className="text-lg font-bold text-slate-900">
                    {Object.values(data).filter(v => v === 'yes').length}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Status Breakdown */}
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Target Status Breakdown (Today)</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-emerald-500" /> Yes
                  </span>
                  <span className="font-bold text-slate-900">{currentStats.totals.yes}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-red-500" /> No
                  </span>
                  <span className="font-bold text-slate-900">{currentStats.totals.no}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-slate-400" /> N/A
                  </span>
                  <span className="font-bold text-slate-900">{currentStats.totals.na}</span>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* FOOTER NAV BAR */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 flex justify-around shadow-xl z-40">
        <button 
          onClick={() => setActiveTab('input')} 
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'input' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <Edit3 size={20} />
          <span className="text-[10px]">Log Day</span>
        </button>

        <button 
          onClick={() => setActiveTab('recent')} 
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'recent' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <Calendar size={20} />
          <span className="text-[10px]">Recent</span>
        </button>

        <button 
          onClick={() => setActiveTab('stats')} 
          className={`flex flex-col items-center gap-1 transition-all ${
            activeTab === 'stats' ? 'text-blue-600 font-bold scale-105' : 'text-slate-400'
          }`}
        >
          <BarChart3 size={20} />
          <span className="text-[10px]">Stats</span>
        </button>
      </nav>
    </div>
  );
}