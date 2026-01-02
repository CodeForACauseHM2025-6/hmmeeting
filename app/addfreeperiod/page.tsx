'use client';

import { useState, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { database } from '@/firebase';
import { ref, set, onValue } from 'firebase/database';

type FreePeriod = {
  day: number;
  start: string;
  end: string;
};

export default function FreePeriodsPage() {
  const router = useRouter();
  const [day, setDay] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [frees, setFrees] = useState<FreePeriod[]>([]);

  // Load existing frees from Firebase
  useEffect(() => {
    const freesRef = ref(database, 'freeTimes/user1');
    const unsubscribe = onValue(freesRef, (snapshot) => {
      if (snapshot.exists()) {
        setFrees(snapshot.val().periods || []);
      }
    });

    return () => unsubscribe();
  }, []);

  async function addFree() {
    if (!day || !start || !end) return;

    const newFrees = [...frees, { day: Number(day), start, end }];
    setFrees(newFrees);
    
    try {
      await set(ref(database, 'freeTimes/user1'), {
        periods: newFrees,
        updatedAt: Date.now()
      });
      console.log('Free periods saved!');
      
      router.push("/profilepage");
    } catch (error) {
      console.error('Error saving free periods:', error);
    }
    
    setDay('');
    setStart('');
    setEnd('');
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
        My Free Periods
      </h1>

      <div
        style={{
          border: '4px solid maroon',
          padding: '20px',
          marginBottom: '30px',
        }}
      >
        <h2>Add New Free:</h2>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ marginRight: '10px' }}>Day:</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            style={{
              padding: '5px 10px',
              fontSize: '16px',
              borderRadius: '4px',
              border: '1px solid #ccc'
            }}
          >
            <option value="">Select day</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(d => (
              <option key={d} value={d}>Day {d}</option>
            ))}
          </select>
        </div>

        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
        />

        <span style={{ margin: '0 10px' }}>to</span>

        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
        />

        <br /><br />
        <button 
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors w-fit" 
          onClick={addFree}
        >
          Add
        </button>
      </div>
    </div>
  );
}