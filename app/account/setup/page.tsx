'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { DAYS, PERIODS, type PeriodValue } from '@/src/config/schedule';

type FreePeriod = {
  day: number;
  period: PeriodValue;
};

const PRIMARY = 'var(--primary)';

export default function SetNamePage() {
  const [fullName, setFullName] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [lastSavedKey, setLastSavedKey] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER' | 'ADMIN'>('STUDENT');

  useEffect(() => {
    if (!loadingProfile) {
      setMessage((prev) => (prev === 'Saving...' ? '' : prev));
    }
  }, [loadingProfile]);

  const { data: session, status } = useSession();
  const router = useRouter();

  const email = session?.user?.email ?? '';

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  useEffect(() => {
    if (!session?.user?.email) return;

    async function loadProfile() {
      const response = await fetch('/api/user/information?includeSchedule=true');
      if (!response.ok) {
        setLoadingProfile(false);
        setHasInitialized(true);
        return;
      }
      const data = await response.json();
      const resolvedName = data?.fullName ?? session?.user?.name ?? '';
      const resolvedRole = data?.role ?? 'STUDENT';
      setFullName(resolvedName);
      setRole(resolvedRole);

      let initialSlots: FreePeriod[] = [];
      if ((resolvedRole === 'STUDENT' || resolvedRole === 'ADMIN') && Array.isArray(data?.studentAvailability)) {
        initialSlots = data.studentAvailability;
      }

      if (resolvedRole === 'TEACHER' && Array.isArray(data?.teacher?.availability)) {
        initialSlots = data.teacher.availability;
      }

      const initialSet = new Set(
        initialSlots.map((slot: FreePeriod) => `${slot.day}-${slot.period}`)
      );
      setSelectedSlots(initialSet);
      setLastSavedKey(buildSaveKey(resolvedName, initialSet));
      setLoadingProfile(false);
      setHasInitialized(true);
    }

    loadProfile();
  }, [session?.user?.email, session?.user?.name]);

  const toggleSlot = (day: number, period: PeriodValue) => {
    setSelectedSlots((prev) => {
      const next = new Set(prev);
      const key = `${day}-${period}`;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const buildSaveKey = (name: string, slots: Set<string>) => {
    const slotKey = Array.from(slots).sort().join(',');
    return `${name.trim()}|${slotKey}`;
  };

  useEffect(() => {
    if (status !== 'authenticated' || loadingProfile || !hasInitialized) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) return;

    const currentKey = buildSaveKey(trimmedName, selectedSlots);
    if (currentKey === lastSavedKey) return;
    if (saving) return;

    const timeout = setTimeout(async () => {
      setSaving(true);
      setMessage('Saving...');

      try {
        const freePeriods = Array.from(selectedSlots).map((slot) => {
          const [dayString, period] = slot.split('-');
          return { day: Number(dayString), period } as FreePeriod;
        });

        const response = await fetch('/api/user/information', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: trimmedName,
            freePeriods,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to save profile');
        }

        const payload = await response.json();
        if (payload?.role) {
          setRole(payload.role);
        }

        const latestKey = buildSaveKey(trimmedName, selectedSlots);
        if (latestKey === currentKey) {
          setLastSavedKey(latestKey);
          setMessage('All changes saved.');
        }
      } catch (error) {
        setMessage(`Error saving profile: ${error}`);
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [fullName, selectedSlots, status, loadingProfile, hasInitialized, lastSavedKey, saving]);

  if (status === 'loading' || loadingProfile) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '50px', maxWidth: '1000px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '28px', marginBottom: '12px', color: PRIMARY }}>
          Account Settings
        </h1>
      </div>

      <div>
        <div
          style={{
            border: `1px solid ${PRIMARY}`,
            borderRadius: '12px',
            padding: '24px',
            marginBottom: '24px',
            background: '#fff',
            boxShadow: '0 12px 24px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your name"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: '#f2f2f2',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600 }}>
                Role
              </label>
              <div
                style={{
                  padding: '10px 12px',
                  fontSize: '16px',
                  border: '1px solid #ccc',
                  borderRadius: '8px',
                  backgroundColor: '#fafafa',
                }}
              >
                {role}
              </div>
            </div>
          </div>
        </div>

        {(role === 'STUDENT' || role === 'TEACHER' || role === 'ADMIN') && (
          <div
            style={{
              border: `1px solid ${PRIMARY}`,
              borderRadius: '12px',
              padding: '24px',
              background: '#fff',
              boxShadow: '0 12px 24px rgba(0,0,0,0.05)',
            }}
          >
            <h2 style={{ fontSize: '20px', marginBottom: '8px', color: PRIMARY }}>
              {role === 'TEACHER' ? 'Select your available periods' : 'Select your free periods'}
            </h2>
            <p style={{ color: '#555', marginBottom: '16px' }}>
              {role === 'TEACHER'
                ? 'Tap the periods you are available to meet. Students will only see periods you select.'
                : 'Tap the periods you are available to meet. This will be used to match with teacher availability.'}
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px' }}>Period</th>
                    {DAYS.map((day) => (
                      <th key={day} style={{ padding: '8px 12px', color: PRIMARY }}>
                        Day {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period) => (
                    <tr key={period}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{period}</td>
                      {DAYS.map((day) => {
                        const key = `${day}-${period}`;
                        const active = selectedSlots.has(key);
                        return (
                          <td key={key} style={{ padding: '8px 12px' }}>
                            <button
                              type="button"
                              onClick={() => toggleSlot(day, period)}
                              style={{
                                width: '100%',
                                padding: '10px 0',
                                borderRadius: '8px',
                                border: `1px solid ${PRIMARY}`,
                                backgroundColor: active ? PRIMARY : '#fff',
                                color: active ? '#fff' : PRIMARY,
                                fontWeight: 600,
                                cursor: 'pointer',
                              }}
                            >
                              {active ? 'Free' : 'Busy'}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{
            marginTop: '24px',
            padding: '12px 20px',
            fontSize: '16px',
            backgroundColor: PRIMARY,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Logout
        </button>
      </div>

      {message && <p style={{ marginTop: '20px', color: PRIMARY }}>{message}</p>}
    </div>
  );
}