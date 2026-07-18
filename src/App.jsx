import React, { useState, useEffect } from 'react';
import { Check, X, Minus, RefreshCw } from 'lucide-react';

// Define the structure of habits
const HABIT_STRUCTURE = [
  { id: 'sleep', label: 'At least 6hrs of sleep', type: 'item' },
  { id: 'walks', label: 'Walks', type: 'group', children: [
    { id: 'walk_morning', label: 'Morning', type: 'item' },
    { id: 'walk_afternoon', label: 'Afternoon', type: 'item' },
    { id: 'walk_evening', label: 'Evening', type: 'item' },
  ]},
  { id: 'steps', label: 'At least 6k steps in a day', type: 'item' },
  { id: 'meals', label: 'Meals Cooked At Home', type: 'group', children: [
    { id: 'meal_breakfast', label: 'Breakfast', type: 'item' },
    { id: 'meal_lunch', label: 'Lunch', type: 'item' },
    { id: 'meal_dinner', label: 'Dinner', type: 'item' },
  ]}
];

// Helper to generate the last N days in DD/MM format
const generateLastNDays = (n) => {
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    dates.push({
      id: `${d.getFullYear()}-${month}-${day}`,
      display: `${day}/${month}`
    });
  }
  return dates;
};

export default function App() {
  const [dates, setDates] = useState([]);
  const [gridState, setGridState] = useState({});

  useEffect(() => {
    setDates(generateLastNDays(7));
  }, []);

  const handleCellClick = (habitId, dateId) => {
    const cellKey = `${habitId}_${dateId}`;
    const currentState = gridState[cellKey] || 'empty';
    
    let nextState;
    switch (currentState) {
      case 'empty': nextState = 'yes'; break;
      case 'yes': nextState = 'no'; break;
      case 'no': nextState = 'na'; break;
      case 'na': nextState = 'empty'; break;
      default: nextState = 'yes';
    }

    setGridState(prev => ({
      ...prev,
      [cellKey]: nextState === 'empty' ? undefined : nextState
    }));
  };

  const HabitCell = ({ habitId, dateId }) => {
    const state = gridState[`${habitId}_${dateId}`] || 'empty';
    
    let bgColor = 'bg-slate-100 hover:bg-slate-200';
    let content = null;

    if (state === 'yes') { bgColor = 'bg-emerald-500 hover:bg-emerald-600'; content = <Check size={16} className="text-white" />; }
    else if (state === 'no') { bgColor = 'bg-red-500 hover:bg-red-600'; content = <X size={16} className="text-white" />; }
    else if (state === 'na') { bgColor = 'bg-gray-400 hover:bg-gray-500'; content = <Minus size={16} className="text-white" />; }

    return (
      <td className="p-1 border border-slate-200 h-12 min-w-[3rem]">
        <button 
          onClick={() => handleCellClick(habitId, dateId)} 
          className={`w-full h-full flex items-center justify-center rounded ${bgColor}`}
        >
          {content}
        </button>
      </td>
    );
  };

  return (
    <div className="p-8 font-sans max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Habit Grid</h1>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-3 border bg-slate-50 text-left">Habit</th>
              {dates.map(date => <th key={date.id} className="p-3 border bg-slate-50">{date.display}</th>)}
            </tr>
          </thead>
          <tbody>
            {HABIT_STRUCTURE.map((item) => (
              item.type === 'group' ? (
                <React.Fragment key={item.id}>
                  <tr className="bg-slate-100">
                    <td colSpan={dates.length + 1} className="p-3 font-bold text-slate-700">{item.label}</td>
                  </tr>
                  {item.children.map(child => (
                    <tr key={child.id}>
                      <td className="p-3 border pl-8">{child.label}</td>
                      {dates.map(date => <HabitCell key={`${child.id}_${date.id}`} habitId={child.id} dateId={date.id} />)}
                    </tr>
                  ))}
                </React.Fragment>
              ) : (
                <tr key={item.id}>
                  <td className="p-3 border font-medium text-slate-700">{item.label}</td>
                  {dates.map(date => <HabitCell key={`${item.id}_${date.id}`} habitId={item.id} dateId={date.id} />)}
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}