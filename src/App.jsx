import React, { useState, useEffect } from 'react';
import { Check, X, Minus, RefreshCw } from 'lucide-react';

const HABIT_STRUCTURE = [
  { id: 'sleep', label: 'At least 6hrs of sleep', type: 'item' },
  { id: 'walks', label: 'Walks', type: 'group', children: [
    { id: 'walk_morning', label: 'Morning', type: 'item' },
    { id: 'walk_afternoon', label: 'Afternoon', type: 'item' },
    { id: 'walk_evening', label: 'Evening', type: 'item' },
  ]},
  { id: 'steps', label: 'At least 6k steps', type: 'item' },
  { id: 'meals', label: 'Meals Cooked', type: 'group', children: [
    { id: 'meal_breakfast', label: 'Breakfast', type: 'item' },
    { id: 'meal_lunch', label: 'Lunch', type: 'item' },
    { id: 'meal_dinner', label: 'Dinner', type: 'item' },
  ]}
];

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
  const [dates, setDates] = useState(generateLastNDays(7));
  const [gridState, setGridState] = useState({});

  const handleCellClick = (habitId, dateId) => {
    const key = `${habitId}_${dateId}`;
    const next = { empty: 'yes', yes: 'no', no: 'na', na: 'empty' }[gridState[key] || 'empty'];
    setGridState(prev => ({ ...prev, [key]: next === 'empty' ? undefined : next }));
  };

  return (
    <div className="p-4 max-w-lg mx-auto font-sans">
      <h1 className="text-xl font-bold mb-4 text-slate-800">Habit Tracker</h1>
      
      {/* Scrollable Container */}
      <div className="overflow-x-auto shadow-sm border rounded-lg">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="p-2 border-b sticky left-0 bg-slate-50 z-10 text-left min-w-[120px]">Habit</th>
              {dates.map(d => <th key={d.id} className="p-2 border-b text-center min-w-[40px]">{d.display}</th>)}
            </tr>
          </thead>
          <tbody>
            {HABIT_STRUCTURE.map((item) => (
              item.type === 'group' ? (
                <React.Fragment key={item.id}>
                  <tr className="bg-slate-100 font-bold text-xs uppercase text-slate-500">
                    <td colSpan={dates.length + 1} className="p-2">{item.label}</td>
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
    </div>
  );
}

function HabitRow({ item, dates, onClick, gridState }) {
  return (
    <tr>
      <td className="p-2 border-b sticky left-0 bg-white z-10 font-medium text-slate-700 truncate max-w-[120px]">
        {item.label}
      </td>
      {dates.map(date => {
        const state = gridState[`${item.id}_${date.id}`] || 'empty';
        const colors = { empty: 'bg-slate-100', yes: 'bg-emerald-500', no: 'bg-red-500', na: 'bg-gray-400' };
        return (
          <td key={date.id} className="p-1 border-b">
            <button 
              onClick={() => onClick(item.id, date.id)}
              className={`w-8 h-8 rounded flex items-center justify-center ${colors[state]}`}
            >
              {state === 'yes' && <Check size={14} className="text-white" />}
              {state === 'no' && <X size={14} className="text-white" />}
              {state === 'na' && <Minus size={14} className="text-white" />}
            </button>
          </td>
        );
      })}
    </tr>
  );
}