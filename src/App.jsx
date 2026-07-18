import React, { useState, useEffect } from 'react';
import { Check, X, Minus, Calendar, Edit3, BarChart3, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';

// Use the CDN-hosted Supabase library
// Ensure you have loaded: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js
const { createClient } = window.supabase;

const SUPABASE_URL = 'https://pvhuqpjpxpepxagruxpo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_MJe9WzgqBoyAg69bOdVujA_B6lecN2k';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const HABITS = ['Sleep', 'Walk Morning', 'Walk Afternoon', 'Walk Evening', 'Steps', 'Breakfast', 'Lunch', 'Dinner'];

export default function App() {
  const [view, setView] = useState('input');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    async function fetchData() {
      const { data: logs, error } = await supabase.from('habit_logs').select('*');
      if (!error && logs) {
        const formatted = {};
        logs.forEach(l => formatted[`${l.habit_id}_${l.date}`] = l.status);
        setData(formatted);
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  const toggle = async (habitId, date) => {
    const key = `${habitId}_${date}`;
    const current = data[key] || 'empty';
    const next = { empty: 'yes', yes: 'no', no: 'na', na: 'empty' }[current];
    
    setData(prev => ({ ...prev, [key]: next === 'empty' ? null : next }));

    if (next === 'empty') {
      await supabase.from('habit_logs').delete().match({ habit_id: habitId, date: date });
    } else {
      await supabase.from('habit_logs').upsert({ habit_id: habitId, date: date, status: next });
    }
  };

  if (loading) return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto text-blue-500" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white p-4 border-b shadow-sm sticky top-0 z-10 flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-800">HabitFlow</h1>
        <Save size={20} className="text-green-600" />
      </header>
      <main className="p-4">
        {view === 'input' && <InputView onToggle={toggle} data={data} today={today} />}
        {view === 'recent' && <RecentView data={data} />}
      </main>
      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-3 shadow-lg">
        <button onClick={() => setView('input')} className={`p-2 ${view === 'input' ? 'text-blue-600' : 'text-slate-400'}`}><Edit3 /></button>
        <button onClick={() => setView('recent')} className={`p-2 ${view === 'recent' ? 'text-blue-600' : 'text-slate-400'}`}><Calendar /></button>
      </nav>
    </div>
  );
}

function InputView({ onToggle, data, today }) {
  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg text-slate-700">Today {today}</h2>
      {HABITS.map(h => (
        <div key={h} className="bg-white p-4 rounded-xl shadow-sm flex items-center justify-between border border-slate-100">
          <span className="font-medium text-slate-700">{h}</span>
          <button 
            onClick={() => onToggle(h, today)} 
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-colors ${
              data[`${h}_${today}`] === 'yes' ? 'bg-emerald-500 text-white' : 
              data[`${h}_${today}`] === 'no' ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-400'
            }`}
          >
            {data[`${h}_${today}`] === 'yes' ? <Check size={24} /> : data[`${h}_${today}`] === 'no' ? <X size={24} /> : <Minus size={24} />}
          </button>
        </div>
      ))}
    </div>
  );
}

function RecentView({ data }) {
  return <div className="p-4 text-center text-slate-500">History view functionality coming soon!</div>;
}