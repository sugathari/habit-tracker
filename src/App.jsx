import React, { useState } from 'react';
import { Check, X, Minus } from 'lucide-react';

const HABIT_STRUCTURE = [
  { id: 'sleep', label: '6hrs Sleep', type: 'item' },
  { id: 'walks', label: 'Walks', type: 'group', children: [
    { id: 'walk_morning', label: 'Morning', type: 'item' },
    { id: 'walk_afternoon', label: 'Afternoon', type: 'item' },
  ]},
  { id: 'steps', label: '6k Steps', type: 'item' },
  { id: 'meals', label: 'Meals Cooked', type: 'group', children: [
    { id: 'meal_breakfast', label: 'Breakfast', type: 'item' },
    { id: 'meal_dinner', label: 'Dinner', type: 'item' },
  ]}
];

// Changed to 3 days for better mobile fit
const generateLastNDays = (n) => {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push({
      id: d.toISOString().split('T')[0],
      display: `${d.getDate()}/${d.getMonth() + 1}`
    });
  }
  return dates;
};

export default function App() {
  const [dates] = useState(generateLastNDays(3)); // Show 3 days
  const [gridState, setGridState] = useState({});

  const handleCellClick = (habitId, dateId) => {
    const key = `${habitId}_${dateId}`;
    const next = { empty: 'yes', yes: 'no', no: 'na', na: 'empty' }[gridState[key] || 'empty'];
    setGridState(prev => ({ ...prev, [key]: next === 'empty' ? undefined : next }));
  };

  return (
    <div className="p-3 max-w-sm mx-auto font-sans bg-white min-h-screen">
      <h1 className="text-xl font-bold mb-4 text-slate-800">My Habits</h1>
      
      <div className="shadow-sm border rounded-xl overflow-hidden">
        <table className="w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-3 border-b sticky left-0 bg-slate-50 z-10 text-left w-24">Habit</th>
              {dates.map(d => <th key={d.id} className="p-3 border-b text-center">{d.display}</th>)}
            </tr>
          </thead>
          <tbody>
            {HABIT_STRUCTURE.map((item) => (
              item.type === 'group' ? (
                <React.Fragment key={item.id}>
                  <tr className="bg-slate-100 font-bold text-[10px] uppercase text-slate-500">
                    <td colSpan={dates.length + 1} className="px-3 py-1">{item.label}</td>
                  </tr>
                  {item.children.map(child => (
                    <HabitRow key={child.id} item={child} dates={dates} onClick={handleCellClick} gridState={gridState} />
                  ))}
                </React.Fragment>
              ) : (
                <HabitRow key={item.id} item={item} dates={dates} onClick={handleCellClick} gridState={gridState} />
              )
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-4 text-center">Tap cells to cycle status</p>
    </div>
  );
}

function HabitRow({ item, dates, onClick, gridState }) {
  return (
    <tr>
      <td className="p-3 border-b sticky left-0 bg-white z-10 font-medium text-slate-700 text-sm">
        {item.label}
      </td>
      {dates.map(date => {
        const state = gridState[`${item.id}_${date.id}`] || 'empty';
        const colors = { empty: 'bg-slate-100', yes: 'bg-emerald-500', no: 'bg-red-500', na: 'bg-gray-400' };
        return (
          <td key={date.id} className="p-2 border-b">
            <button 
              onClick={() => onClick(item.id, date.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${colors[state]}`}
            >
              {state === 'yes' && <Check size={20} className="text-white" />}
              {state === 'no' && <X size={20} className="text-white" />}
              {state === 'na' && <Minus size={20} className="text-white" />}
            </button>
          </td>
        );
      })}
    </tr>
  );
}