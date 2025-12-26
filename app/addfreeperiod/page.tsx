'use client';

import { useState } from 'react';
import { useRouter } from "next/navigation";

type FreePeriod = {
  start: string;
  end: string;
};

export default function FreePeriodsPage() {
  const router = useRouter();
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [frees, setFrees] = useState<FreePeriod[]>([
    { start: '09:15', end: '09:35' },
    { start: '09:35', end: '10:00' },
  ]);

  function addFree() {
    
    if (!start || !end) return;

    setFrees([...frees, { start, end }]);
    setStart('');
    setEnd('');
  }

  return (
    <div style={{ padding: '40px', maxWidth: '800px' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
        My Free Periods
      </h1>

      {/* Add New Free */}
      <div
        style={{
          border: '4px solid maroon',
          padding: '20px',
          marginBottom: '30px',
        }}
      >
        <h2>Add New Free:</h2>

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
        <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors w-fit" onClick={()=>router.push("/profilepage")}>Add</button>
      </div>
    </div>
  );
}
