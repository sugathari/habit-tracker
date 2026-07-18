import React, { useState } from 'react';
import { Check, X, Minus, BarChart3, Edit3, Calendar } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const HABITS = [
  { id: 'sleep', label: '6hrs+ Sleep' },
  { id: 'walk_m', label: 'Morning Walk' },
  { id: 'walk_a', label: 'Afternoon Walk' },
  { id: 'walk_e', label: 'Evening Walk' },
  { id: 'steps', label: '6k Steps' },
  { id: 'meal_b', label: 'Breakfast' },
  { id: 'meal_l', label: 'Lunch' },
  { id: 'meal_d', label: 'Dinner' }
];

export default function App() {
  const [view, setView] = useState('input');
  const [gridData, setGridData] = useState({});

  const toggle = (habitId) => {
    const today = new Date().toISOString().split('T')[0];
    const key = `${habitId}_${today}`;
    const next = { empty: 'yes', yes: 'no', no: 'na', na: 'empty' }[gridData[key] || 'empty'];
    setGridData({ ...gridData, [key]: next === 'empty' ? undefined : next });
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="bg-white p-4 border-b shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold text-slate-800">HabitFlow</h1>
      </header>

      <main className="p-4">
        {view === 'input' && <InputView onToggle={toggle} data={gridData} />}
        {view === 'recent' && <RecentView data={gridData} />}
        {view === 'stats' && <StatsView data={gridData} />}
      </main>

      <nav className="fixed bottom-0 w-full bg-white border-t flex justify-around p-3 shadow-lg z-20">
        <button onClick={() => setView('input')} className={view === 'input' ? 'text-emerald-600' : 'text-slate-400'}><Edit3 size={24} /></button>
        <button onClick={() => setView('recent')} className={view === 'recent' ? 'text-emerald-600' : 'text-slate-400'}><Calendar size={24} /></button>
        <button onClick={() => setView('stats')} className={view === 'stats' ? 'text-emerald-600' : 'text-slate-400'}><BarChart3 size={24} /></button>
      </nav>
    </div>
  );
}

function InputView({ onToggle, data }) {
  const today = new Date().toISOString().split('T')[0];
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold mb-2">Today: {today}</h2>
      {HABITS.map(h => (
        <div key={h.id} className="bg-white p-4 rounded-xl shadow-sm border flex justify-between items-center">
          <span className="font-medium text-slate-700">{h.label}</span>
          <button 
            onClick={() => onToggle(h.id)}
            className={`w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold
              ${(data[`${h.id}_${today}`] === 'yes') ? 'bg-emerald-500' : 
                (data[`${h.id}_${today}`] === 'no') ? 'bg-red-500' : 'bg-slate-200'}`}
          >
            {data[`${h.id}_${today}`] === 'yes' ? <Check /> : data[`${h.id}_${today}`] === 'no' ? <X /> : <Minus />}
          </button>
        </div>
      ))}
    </div>
  );
}

function RecentView({ data }) {
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <label className="block text-sm font-medium text-slate-500 mb-2">Select Date</label>
        <input 
          type="date" 
          value={selectedDate} 
          onChange={(e) => setSelectedDate(e.target.value)}
          className="w-full p-3 border rounded-lg bg-slate-50"
        />
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <h3 className="font-bold mb-4 text-slate-700 border-b pb-2">{selectedDate}</h3>
        <div className="grid grid-cols-1 gap-2">
          {HABITS.map(h => (
            <div key={h.id} className="text-sm p-3 bg-slate-50 rounded flex justify-between items-center">
              <span className="font-medium text-slate-700">{h.label}</span>
              <span className={`px-2 py-1 rounded font-bold uppercase ${data[`${h.id}_${selectedDate}`] === 'yes' ? 'bg-emerald-100 text-emerald-700' : 'text-slate-400'}`}>
                {data[`${h.id}_${selectedDate}`] || '-'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatsView({ data }) {
  const [selectedHabit, setSelectedHabit] = useState(HABITS[0].id);
  const chartData = [{ name: 'Mon', v: 0.8 }, { name: 'Tue', v: 0.9 }, { name: 'Wed', v: 0.6 }, { name: 'Thu', v: 0.8 }, { name: 'Fri', v: 1.0 }, { name: 'Sat', v: 0.7 }, { name: 'Sun', v: 0.9 }];

  return (
    <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4">
      <h2 className="text-xl font-bold text-slate-800">Analytics</h2>
      <select className="w-full p-3 border rounded-lg bg-slate-50" onChange={(e) => setSelectedHabit(e.target.value)}>
        {HABITS.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
      </select>
      <div className="h-64 w-full">
        <ResponsiveContainer>
          <LineChart data={chartData}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={4} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}