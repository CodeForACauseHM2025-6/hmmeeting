// Create this file at: app/UserContext.tsx
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type UserContextType = {
  currentUserId: string;
  setCurrentUserId: (id: string) => void;
};

const UserContext = createContext<UserContextType>({
  currentUserId: 'user1',
  setCurrentUserId: () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [currentUserId, setCurrentUserId] = useState('user1');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('currentUserId');
    if (saved) {
      setCurrentUserId(saved);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('currentUserId', currentUserId);
  }, [currentUserId]);

  return (
    <UserContext.Provider value={{ currentUserId, setCurrentUserId }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}

// User Switcher Component - Add this to your layout or any page for testing
export function UserSwitcher() {
  const { currentUserId, setCurrentUserId } = useUser();

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      backgroundColor: '#333',
      color: 'white',
      padding: '10px',
      borderRadius: '8px',
      zIndex: 1000,
      fontSize: '14px'
    }}>
      <div style={{ marginBottom: '5px', fontWeight: 'bold' }}>Test User:</div>
      <select
        value={currentUserId}
        onChange={(e) => setCurrentUserId(e.target.value)}
        style={{
          padding: '5px',
          borderRadius: '4px',
          backgroundColor: 'white',
          color: 'black',
          cursor: 'pointer'
        }}
      >
        <option value="user1">User 1</option>
        <option value="user2">User 2</option>
        <option value="user3">User 3</option>
      </select>
    </div>
  );
}