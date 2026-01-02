'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { database } from '@/firebase';
import { ref, set } from 'firebase/database';

export default function SetNamePage() {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      // Save name to database under 'names' section
      await set(ref(database, 'names/user1'), {
        name: name,
        updatedAt: Date.now()
      });
      
      setMessage('Name saved successfully!');
      setName('');
      
      // Redirect to profile page after saving
      router.push('/profilepage');
    } catch (error) {
      setMessage('Error saving name: ' + error);
    }
  };

  return (
    <div style={{ padding: '50px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Set Your Name</h1>
      
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          required
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            marginBottom: '10px'
          }}
        />
        
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Save Name
        </button>
      </form>
      
      {message && <p style={{ marginTop: '20px', color: 'green' }}>{message}</p>}
    </div>
  );
}