import React, { useState, useEffect, useRef } from 'react';
import { Edit3, Calendar, Check, X, Minus, Loader2, Utensils, Footprints, Moon, Sun, Sunset, Briefcase, Home, Plane, RefreshCw } from 'lucide-react';

// 1. FIXED CONFIGURATION ARRAYS
const CORE_GOALS = [
  { id: 'sleep', label: '6+ Hours of Sleep', icon: <Moon size={18} className="text-indigo-500" /> },
  { id: 'steps', label: '6k+ Steps', icon: <Footprints size={18} className="text-emerald-500" /> }
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

// Helper to get YYYY-MM-DD in local time string
const formatDateString = (date) => {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
};

export default function App() {
  // Navigation & Date States
  const [activeTab, setActiveTab] = useState('input');
  const [selectedDate, setSelectedDate] = useState(formatDateString(new Date()));
  
  // Database & App States
  const [supabase, setSupabase] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncStatus, setSyncStatus] = useState('Connecting...');
  
  // Main Data States mapped by date string: { "YYYY-MM-DD": { ...logs } }
  const [allLogs, setAllLogs] = useState({});
  const [journalText, setJournalText] = useState('');
  const [savingJournal, setSavingJournal] = useState(false);
  
  const journalDebounceTimeout = useRef(null);
  const todayStr = formatDateString(new Date());

  // 2. RUNTIME CDN SUPABASE LOADER
  useEffect(() => {
    const checkSupabase = setInterval(() => {
      if (window.supabase) {
        clearInterval(checkSupabase);
        try {
          // Pull keys from localStorage if saved via dynamic setup, or fallback to window constants
          const savedUrl = localStorage.getItem('supabase_url') || 'https://pvhuqpjpxpepxagruxpo.supabase.co';
          const savedKey = localStorage.getItem('supabase_key') || 'sb_publishable_MJe9WzgqBoyAg69bOdVujA_B6lecN2k';
          
          if (savedUrl === 'YOUR_SUPABASE_PROJECT_URL') {
            setSyncStatus('Local Sandbox Mode');
            setLoading(false);
            return;
          }

          const client = window.supabase.createClient(savedUrl, savedKey);
          setSupabase(client);
          setSyncStatus('Cloud Synced');
          fetchHistoricalLogs(client);
        } catch (err) {
          console.error("Supabase config error:", err);
          setSyncStatus('Config Error');
          setLoading(false);
        }
      }
    }, 100);

    setTimeout(() => {
      if (!window.supabase) {
        clearInterval(checkSupabase);
        setSyncStatus('Offline Sandbox');
        setLoading(false);
      }
    }, 4000);
  }, []);

  // 3. FETCH DATABASE PROGRESS LOGS
  const fetchHistoricalLogs = async (client) => {
    try {
      const { data, error } = await client
        .from('habit_logs')
        .select('*')
        .order('log_date', { ascending: false });

      if (error) throw error;

      if (data) {
        const parsedLogs = {};
        data.forEach(row => {
          parsedLogs[row.log_date] = {
            ...row.metrics,
            day_context: row.day_context || 'home',
            journal_entry: row.journal_entry || ''
          };
        });
        setAllLogs(parsedLogs);
        
        // Sync initial text box state to currently targeted date
        if (parsedLogs[selectedDate]?.journal_entry) {
          setJournalText(parsedLogs[selectedDate].journal_entry);
        }
      }
    } catch (err) {
      console.error("Error reading database table rows:", err);
    } finally {
      setLoading(false);
    }
  };

  // Sync textbox input context gracefully when selected date moves
  useEffect(() => {
    setJournalText(allLogs[selectedDate]?.journal_entry || '');
  }, [selectedDate, allLogs]);

  // 4. PERSIST AND UPSERT METRICS DATA CHANGES
  const updateDayData = async (dateKey, updatedFields) => {
    const currentDayData = allLogs[dateKey] || { day_context: 'home', journal_entry: '' };
    const cleanDayData = { ...currentDayData, ...updatedFields };
    
    // Optimistic UI state adjustment
    setAllLogs(prev => ({
      ...prev,
      [dateKey]: cleanDayData
    }));

    if (!supabase) return; // Keep sandbox dynamic features intact without crashing

    try {
      setSyncStatus('Syncing changes...');
      const { error } = await supabase
        .from('habit_logs')
        .upsert({
          log_date: dateKey,
          day_context: cleanDayData.day_context,
          journal_entry: cleanDayData.journal_entry,
          metrics: Object.keys(cleanDayData).reduce((acc, k) => {
            if (k !== 'day_context' && k !== 'journal_entry') acc[k] = cleanDayData[k];
            return acc;
          }, {})
        }, { onConflict: 'log_date' });

      if (error) throw error;
      setSyncStatus('Cloud Synced');
    } catch (err) {
      console.error("Failed to commit data changes to cloud state:", err);
      setSyncStatus('Connection Interrupted');
    }
  };

  // 5. DEBOUNCED TEXT JOURNAL WRITER
  const handleJournalChange = (text) => {
    setJournalText(text);
    setSavingJournal(true);

    if (journalDebounceTimeout.current) clearTimeout(journalDebounceTimeout.current);

    journalDebounceTimeout.current = setTimeout(() => {
      updateDayData(selectedDate, { journal_entry: text }).then(() => {
        setSavingJournal(false);
      });
    }, 1200);
  };

  // Helper selectors
  const activeLogs = allLogs[selectedDate] || {};
  const currentContext = activeLogs.day_context || 'home';

  // 6. DECOUPLED STATS ALGORITHMS
  const calculateDailyProgress = (dateStr) => {
    const targetLogs = allLogs[dateStr] || {};
    let matched = 0;
    CORE_GOALS.forEach(g => {
      if (targetLogs[g.id] === 'yes') matched++;
    });
    return { completed: matched, total: CORE_GOALS.length, pct: matched ? (matched / CORE_GOALS.length) * 100 : 0 };
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

  // Formats historical arrays into specific blocks of 21 days (3-week intervals)
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 flex-col gap-3">
        <Loader2 className="animate-spin text-indigo-600 w-10 h-10" />
        <p className="text-sm font-medium text-slate-500">Loading HabitFlow Engine...</p>
      </div>
    );
  }

  // Generate localized 3-day strip dates
  const dateStrip = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dateStrip.push({
      key: formatDateString(d),
      label: i === 0 ? '★ TODAY' : d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 font-sans text-slate-800 antialiased">
      {/* HEADER NAVBAR */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900">HabitFlow <span className="text-indigo-600">⚡</span></h1>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            syncStatus.includes('Synced') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${syncStatus.includes('Synced') ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            {syncStatus}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-xl p-4">
        {activeTab === 'input' ? (
          <div className="space-y-5">
            
            {/* 1. DYNAMIC HEADER CARD: STATS GRID */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Habit Strength & Kinetic Progress</h2>
              
              {/* Core Bar */}
              <div className="mt-4">
                <div className="flex justify-between text-sm font-bold mb-1">
                  <span className="text-slate-700">Today's Goal Tracker</span>
                  <span className="text-indigo-600">{calculateDailyProgress(selectedDate).pct}% ({calculateDailyProgress(selectedDate).completed} of 2 met)</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div 
                    className="h-full bg-indigo-600 transition-all duration-500 ease-out" 
                    style={{ width: `${calculateDailyProgress(selectedDate).pct}%` }} 
                  />
                </div>
              </div>

              <div className="mt-4 flex justify-between border-t pt-3 text-xs text-slate-500">
                <div>Weekly Average: <span className="font-bold text-slate-800">{getWeeklyAverage()}%</span></div>
              </div>

              {/* 3-Week Rolling blocks array */}
              <div className="mt-4 border-t pt-3">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-2">3-Week Momentum Trend (Solidification Index)</span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-slate-50 p-2 border">
                    <span className="block text-slate-400 text-[10px]">Wks 7-9</span>
                    <span className="font-bold text-slate-700">{getRollingBlockAverage(2)}%</span>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 border">
                    <span className="block text-slate-400 text-[10px]">Wks 4-6</span>
                    <span className="font-bold text-slate-700">{getRollingBlockAverage(1)}%</span>
                  </div>
                  <div className="rounded-lg bg-indigo-50/50 p-2 border border-indigo-100">
                    <span className="block text-indigo-500 font-semibold text-[10px]">Current Block</span>
                    <span className="font-bold text-indigo-700">{getRollingBlockAverage(0)}%</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. TIMELINE STRIP FOCUS */}
            <section className="flex items-center justify-between gap-1 bg-white p-2 border rounded-xl shadow-sm overflow-x-auto">
              <div className="flex gap-1.5">
                {dateStrip.map(d => (
                  <button
                    key={d.key}
                    onClick={() => setSelectedDate(d.key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      selectedDate === d.key 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              
              <div className="flex items-center gap-1.5 pl-2 border-l">
                <input 
                  type="date" 
                  max={todayStr}
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="p-1 rounded bg-slate-100 text-slate-700 border text-xs cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {selectedDate !== todayStr && (
                  <button 
                    onClick={() => setSelectedDate(todayStr)}
                    className="p-1.5 text-xs text-indigo-600 hover:bg-indigo-50 rounded-lg font-bold flex items-center gap-0.5 transition-colors"
                    title="Jump to Today"
                  >
                    <RefreshCw size={12} /> Today
                  </button>
                )}
              </div>
            </section>

            {/* 3. DYNAMIC DAY ENVIRONMENT CONTEXT SWITCH */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">Day Context Framework</h3>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => updateDayData(selectedDate, { day_context: 'home' })}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                    currentContext === 'home'
                      ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Home size={14} /> Home Day
                </button>
                <button
                  onClick={() => updateDayData(selectedDate, { day_context: 'office' })}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                    currentContext === 'office'
                      ? 'bg-blue-50 text-blue-800 border-blue-300 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Briefcase size={14} /> Office Day
                </button>
                <button
                  onClick={() => updateDayData(selectedDate, { day_context: 'travel' })}
                  className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg border transition-all ${
                    currentContext === 'travel'
                      ? 'bg-purple-50 text-purple-800 border-purple-300 shadow-sm'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <Plane size={14} /> Travel Day
                </button>
              </div>
            </section>

            {/* 4. CORE OUTCOME STRIP (100% STAT DRIVING WEIGHT) */}
            <section className="space-y-2">
              <div className="px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Core Outcome Goals</h3>
              </div>
              {CORE_GOALS.map(goal => {
                const status = activeLogs[goal.id] || 'empty';
                return (
                  <div key={goal.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-2.5">
                      {goal.icon}
                      <span className="font-semibold text-slate-700 text-sm">{goal.label}</span>
                    </div>
                    <div className="flex gap-1 bg-slate-100 p-0.5 rounded-lg border">
                      <button
                        onClick={() => updateDayData(selectedDate, { [goal.id]: 'yes' })}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          status === 'yes' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        YES
                      </button>
                      <button
                        onClick={() => updateDayData(selectedDate, { [goal.id]: 'no' })}
                        className={`px-3 py-1 rounded-md text-xs font-bold transition-all ${
                          status === 'no' ? 'bg-red-500 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        NO
                      </button>
                    </div>
                  </div>
                );
              })}
            </section>

            {/* 5. BEHAVIORAL CONTEXT METADATA MATRIX (0% STAT WEIGHT) */}
            <section className="space-y-3">
              <div className="px-1 border-t pt-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Behavioral Context Logs</h3>
              </div>

              {/* WALKS MATRIX CONTAINER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase">▼ Walks Context Timestamps</h4>
                </div>
                <div className="space-y-2.5">
                  {WALK_TASKS.map(task => {
                    const status = activeLogs[task.id] || 'empty';
                    return (
                      <div key={task.id} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 text-slate-700 font-medium">
                          {task.icon}
                          {task.label}
                        </div>
                        <div className="flex bg-slate-50 p-0.5 rounded-md border text-[11px] font-bold">
                          {['yes', 'no', 'na'].map(state => (
                            <button
                              key={state}
                              onClick={() => updateDayData(selectedDate, { [task.id]: state })}
                              className={`px-2 py-0.5 uppercase rounded ${
                                status === state 
                                  ? state === 'yes' ? 'bg-emerald-500 text-white' : state === 'no' ? 'bg-red-500 text-white' : 'bg-slate-400 text-white'
                                  : 'text-slate-500 hover:bg-slate-200'
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

              {/* MEALS FUELING MATRIX CONTAINER */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1"><Utensils size={12}/> ▼ Meal Fueling Diary</h4>
                </div>
                <div className="space-y-3">
                  {MEAL_TASKS.map(task => {
                    const status = activeLogs[task.id] || 'empty';
                    return (
                      <div key={task.id} className="flex flex-col gap-1.5 pb-2 border-b border-dashed last:border-0 last:pb-0">
                        <span className="text-xs font-semibold text-slate-600 pl-1">{task.label}</span>
                        <div className="grid grid-cols-4 gap-1 bg-slate-50 p-0.5 rounded-lg border text-[10px] font-bold text-center">
                          {[
                            { key: 'cooked', label: '🍳 COOKED' },
                            { key: 'ordered', label: '🏙️ ORDERED' },
                            { key: 'ate_out', label: '💼 ATE OUT' },
                            { key: 'skipped', label: '💨 SKIPPED' }
                          ].map(opt => (
                            <button
                              key={opt.key}
                              onClick={() => updateDayData(selectedDate, { [task.id]: opt.key })}
                              className={`py-1 rounded-md transition-all uppercase ${
                                status === opt.key
                                  ? opt.key === 'cooked' ? 'bg-emerald-500 text-white shadow-sm' :
                                    opt.key === 'ordered' ? 'bg-blue-500 text-white shadow-sm' :
                                    opt.key === 'ate_out' ? 'bg-indigo-500 text-white shadow-sm' : 'bg-slate-400 text-white shadow-sm'
                                  : 'text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {opt.label.split(' ')[1]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 6. TEXT BOX JOURNAL & REFLECTION CELL */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
              <div className="flex justify-between items-center border-b pb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">📝 Daily Reflection & Mood Context</h3>
                <span className="text-[10px] font-medium text-slate-400">
                  {savingJournal ? 'Saving...' : 'Saved'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed italic">
                How are you feeling today? Any specific blockers, triggers, or calendar wins?
              </p>
              <textarea
                value={journalText}
                onChange={(e) => handleJournalChange(e.target.value)}
                placeholder="Had intense back-to-back meetings today. Felt super drained by 2 PM..."
                rows={3}
                className="w-full text-xs p-3 border rounded-xl bg-slate-50/50 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-medium leading-normal"
              />
            </section>
          </div>
        ) : (
          /* ARCHIVE / REFLECTION TAB VIEW */
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Historical Log History</h2>
              <p className="text-xs text-slate-500 mt-0.5">Review chronological entries and cross-reference behavioral metadata indicators.</p>
            </div>
            
            <div className="space-y-3 divide-y">
              {Object.keys(allLogs).length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center font-medium">No recorded habit checkpoints synchronized yet.</p>
              ) : (
                Object.keys(allLogs).sort((a,b) => b.localeCompare(a)).map(dateKey => {
                  const dayData = allLogs[dateKey];
                  const dailyProgress = calculateDailyProgress(dateKey);
                  return (
                    <div key={dateKey} className="pt-3 first:pt-0 text-xs">
                      <div className="flex justify-between items-center font-bold text-slate-700">
                        <span>{dateKey} <span className="font-normal capitalize text-slate-400">({dayData.day_context || 'home'} day)</span></span>
                        <span className="text-indigo-600 font-extrabold">{dailyProgress.pct}% Core Goals</span>
                      </div>
                      
                      {dayData.journal_entry && (
                        <div className="mt-1.5 bg-slate-50 p-2 rounded-lg border border-dashed text-slate-600 font-medium italic">
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
      </main>

      {/* FOOTER TAB NAV BAR */}
      <nav className="fixed bottom-0 left-0 right-0 border-t bg-white px-6 py-3 shadow-xl flex justify-around items-center z-50">
        <button 
          onClick={() => setActiveTab('input')} 
          className={`flex flex-col items-center gap-0.5 text-xs font-bold transition-colors ${activeTab === 'input' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Edit3 size={18} />
          <span>Log Today</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`flex flex-col items-center gap-0.5 text-xs font-bold transition-colors ${activeTab === 'history' ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          <Calendar size={18} />
          <span>View History</span>
        </button>
      </nav>
    </div>
  );
}