import React, { useState, useEffect } from 'react';
import { Check, X, Minus, Calendar, Edit3, BarChart3, Loader2, Save } from 'lucide-react';

// Initialize Supabase from the global window object (provided by the CDN script)
const supabase = window.supabase ? window.supabase.createClient('https://pvhuqpjpxpepxagruxpo.supabase.co', 'sb_publishable_MJe9WzgqBoyAg69bOdVujA_B6lecN2k') : null;

export default function App() {
  const [activeTab, setActiveTab] = useState('input');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      console.error("Supabase not initialized. Check your CDN script.");
      setLoading(false);
      return;
    }
    
    async function fetchData() {
      setLoading(true);
      const { data: logs, error } = await supabase
        .from('habit_logs')
        .select('*');
      
      if (!error) setData(logs || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const toggleHabit = async (habitId, date, status) => {
    const nextStatus = status === 'yes' ? 'no' : status === 'no' ? 'na' : 'yes';
    
    // Update local state
    setData(prev => [...prev.filter(d => !(d.habit_id === habitId && d.date === date)), { habit_id: habitId, date, status: nextStatus }]);

    // Update Database
    await supabase
      .from('habit_logs')
      .upsert({ habit_id: habitId, date, status: nextStatus }, { onConflict: 'habit_id,date' });
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-4 font-sans">
      <h1 className="text-2xl font-bold mb-6">HabitFlow</h1>
      
      {activeTab === 'input' && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Log Today</h2>
          {/* Input components would go here */}
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 flex justify-around">
        <button onClick={() => setActiveTab('input')} className={activeTab === 'input' ? 'text-blue-600' : ''}><Edit3 /></button>
        <button onClick={() => setActiveTab('recent')} className={activeTab === 'recent' ? 'text-blue-600' : ''}><Calendar /></button>
        <button onClick={() => setActiveTab('stats')} className={activeTab === 'stats' ? 'text-blue-600' : ''}><BarChart3 /></button>
      </nav>
    </div>
  );
}