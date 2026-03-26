'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { DAYS, PERIODS, type PeriodValue } from '@/src/config/schedule';

type FreePeriod = {
  day: number;
  period: PeriodValue;
  type?: string;
};

const PRIMARY = 'var(--primary)';

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  // Replace underscores/dots with spaces, capitalize each word
  return local
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type SlotState = 'FREE' | 'OFFICE_HOURS';

export default function SetNamePage() {
  const [fullName, setFullName] = useState('');
  // For students/admins: Set<string> of selected free periods
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  // For teachers: Map<string, SlotState> tracking each slot's state
  const [slotStates, setSlotStates] = useState<Map<string, SlotState>>(new Map());
  const [defaultRoom, setDefaultRoom] = useState('');
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
  const searchParams = useSearchParams();
  const viewUserEmail = searchParams.get('viewUser');

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
        // New user — set BREAK as free by default and derive name
        const derivedName = session?.user?.name || nameFromEmail(session?.user?.email ?? '');
        setFullName(derivedName);
        const breakDefaults = new Set(DAYS.map((day) => `${day}-BREAK`));
        setSelectedSlots(breakDefaults);
        setLastSavedKey(buildStudentSaveKey(derivedName, breakDefaults));
        setLoadingProfile(false);
        setHasInitialized(true);
        return;
      }
      const data = await response.json();
      // Use OAuth name, fall back to DB name, then derive from email
      const oauthName = session?.user?.name ?? '';
      const resolvedName = oauthName || data?.fullName || nameFromEmail(email);
      const resolvedRole = data?.role ?? 'STUDENT';
      setFullName(resolvedName);
      setRole(resolvedRole);

      if (resolvedRole === 'TEACHER') {
        // Load teacher slot states (with type)
        const stateMap = new Map<string, SlotState>();
        if (Array.isArray(data?.teacher?.availability)) {
          for (const slot of data.teacher.availability) {
            const key = `${slot.day}-${slot.period}`;
            stateMap.set(key, slot.type === 'OFFICE_HOURS' ? 'OFFICE_HOURS' : 'FREE');
          }
        }
        // Default BREAK to FREE for all days if no schedule saved yet
        if (stateMap.size === 0) {
          for (const day of DAYS) {
            stateMap.set(`${day}-BREAK`, 'FREE');
          }
        }
        setSlotStates(stateMap);
        // Load default room
        setDefaultRoom(data?.teacher?.room ?? '');
        setLastSavedKey(buildTeacherSaveKey(resolvedName, stateMap, data?.teacher?.room ?? ''));
      } else {
        // Student/Admin: use simple Set
        let initialSlots: FreePeriod[] = [];
        if (Array.isArray(data?.studentAvailability)) {
          initialSlots = data.studentAvailability;
        }
        const initialSet = new Set(
          initialSlots.map((slot: FreePeriod) => `${slot.day}-${slot.period}`)
        );
        // Default BREAK to free for all days if no schedule saved yet
        if (initialSet.size === 0) {
          for (const day of DAYS) {
            initialSet.add(`${day}-BREAK`);
          }
        }
        setSelectedSlots(initialSet);
        setLastSavedKey(buildStudentSaveKey(resolvedName, initialSet));
      }

      setLoadingProfile(false);
      setHasInitialized(true);
    }

    loadProfile();
  }, [session?.user?.email, session?.user?.name]);

  // Student/Admin toggle (binary: busy/free)
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

  // Teacher toggle (3-state: Busy → FREE → OFFICE_HOURS → Busy)
  const cycleSlot = (day: number, period: PeriodValue) => {
    setSlotStates((prev) => {
      const next = new Map(prev);
      const key = `${day}-${period}`;
      const current = next.get(key);
      if (!current) {
        // Busy → FREE
        next.set(key, 'FREE');
      } else if (current === 'FREE') {
        // FREE → OFFICE_HOURS
        next.set(key, 'OFFICE_HOURS');
      } else {
        // OFFICE_HOURS → Busy
        next.delete(key);
      }
      return next;
    });
  };

  const buildStudentSaveKey = (name: string, slots: Set<string>) => {
    const slotKey = Array.from(slots).sort().join(',');
    return `S|${name.trim()}|${slotKey}`;
  };

  const buildTeacherSaveKey = (name: string, states: Map<string, SlotState>, room: string) => {
    const stateEntries = Array.from(states.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(',');
    return `T|${name.trim()}|${stateEntries}|${room.trim()}`;
  };

  // Auto-save effect
  useEffect(() => {
    if (status !== 'authenticated' || loadingProfile || !hasInitialized) return;

    const trimmedName = fullName.trim();
    if (!trimmedName) return;

    const currentKey =
      role === 'TEACHER'
        ? buildTeacherSaveKey(trimmedName, slotStates, defaultRoom)
        : buildStudentSaveKey(trimmedName, selectedSlots);

    if (currentKey === lastSavedKey) return;
    if (saving) return;

    const timeout = setTimeout(async () => {
      setSaving(true);
      setMessage('Saving...');

      try {
        let freePeriods: FreePeriod[];
        if (role === 'TEACHER') {
          freePeriods = Array.from(slotStates.entries()).map(([key, type]) => {
            const [dayString, period] = key.split('-');
            return { day: Number(dayString), period: period as PeriodValue, type };
          });
        } else {
          freePeriods = Array.from(selectedSlots).map((slot) => {
            const [dayString, period] = slot.split('-');
            return { day: Number(dayString), period: period as PeriodValue };
          });
        }

        const bodyPayload: Record<string, unknown> = {
          fullName: trimmedName,
          freePeriods,
        };

        if (role === 'TEACHER') {
          bodyPayload.room = defaultRoom.trim();
        }

        const response = await fetch('/api/user/information', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || 'Failed to save profile');
        }

        const payload = await response.json();
        if (payload?.role) {
          setRole(payload.role);
        }

        const latestKey =
          role === 'TEACHER'
            ? buildTeacherSaveKey(trimmedName, slotStates, defaultRoom)
            : buildStudentSaveKey(trimmedName, selectedSlots);
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
  }, [fullName, selectedSlots, slotStates, defaultRoom, status, loadingProfile, hasInitialized, lastSavedKey, saving, role]);

  if (status === 'loading' || loadingProfile) {
    return <div style={{ padding: '50px', textAlign: 'center' }}>Loading...</div>;
  }

  const isViewOnly = !!viewUserEmail;

  return (
    <div style={{ padding: '50px', maxWidth: '1000px', margin: '0 auto' }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: '34px', fontWeight: 700, marginBottom: '8px', color: PRIMARY }}>
          {isViewOnly ? 'User Schedule' : 'Account Settings'}
        </h1>
        <div style={{ background: 'var(--accent)', height: '3px', width: '60px', borderRadius: '2px', marginBottom: '28px' }} />
      </div>

      <div>
        <div
          style={{
            borderLeft: '4px solid var(--primary)',
            borderRadius: '10px',
            padding: '28px',
            marginBottom: '32px',
            background: '#fff',
            boxShadow: '0 4px 20px rgba(91,13,31,0.08)',
          }}
        >
          <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                disabled
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '15px',
                  border: '2px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: '#f5f2ed',
                }}
              />
              <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>Set by your Google account</p>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  fontSize: '15px',
                  border: '2px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: '#f5f2ed',
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                Role
              </label>
              <div
                style={{
                  padding: '12px 14px',
                  fontSize: '15px',
                  border: '2px solid var(--border)',
                  borderRadius: '8px',
                  backgroundColor: '#f5f2ed',
                  fontWeight: 600,
                }}
              >
                {role}
              </div>
            </div>
          </div>

          {/* Default Room input for teachers */}
          {role === 'TEACHER' && !isViewOnly && (
            <div style={{ marginTop: '16px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>
                Default Room (for office hours)
              </label>
              <input
                type="text"
                value={defaultRoom}
                onChange={(e) => setDefaultRoom(e.target.value)}
                placeholder="e.g. 315L"
                style={{
                  width: '100%',
                  maxWidth: '300px',
                  padding: '12px 14px',
                  fontSize: '15px',
                  border: !defaultRoom.trim() ? '2px solid var(--danger)' : '2px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: !defaultRoom.trim() ? '0 0 0 3px rgba(185, 28, 28, 0.15)' : undefined,
                }}
              />
              {!defaultRoom.trim() ? (
                <p style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                  Room number is required to set your schedule
                </p>
              ) : (
                <p style={{ color: '#666', fontSize: '13px', marginTop: '4px' }}>
                  This room will be auto-filled when students book your office hours.
                </p>
              )}
            </div>
          )}
        </div>

        {role === 'TEACHER' && !defaultRoom.trim() && !isViewOnly && (
          <div style={{
            borderLeft: '4px solid var(--border)',
            borderRadius: '10px',
            padding: '28px',
            background: '#fafafa',
            color: 'var(--muted)',
            fontWeight: 600,
            fontSize: '15px',
          }}>
            Set your room number above to configure your schedule.
          </div>
        )}

        {(role === 'STUDENT' || role === 'TEACHER' || role === 'ADMIN') && (role !== 'TEACHER' || defaultRoom.trim()) && (
          <div
            style={{
              borderLeft: '4px solid var(--primary)',
              borderRadius: '10px',
              padding: '28px',
              background: '#fff',
              boxShadow: '0 4px 20px rgba(91,13,31,0.08)',
            }}
          >
            <h2 style={{ fontFamily: 'var(--font-lora, Georgia, serif)', fontSize: '24px', fontWeight: 700, marginBottom: '8px', color: PRIMARY }}>
              {role === 'TEACHER' ? 'Select your available periods' : 'Select your free periods'}
            </h2>
            <p style={{ color: '#555', marginBottom: '16px' }}>
              {role === 'TEACHER'
                ? 'Tap the periods you are available to meet. Students will only see periods you select.'
                : 'Tap the periods you are available to meet. This will be used to match with user availability.'}
            </p>

            {/* Color legend for teachers */}
            {role === 'TEACHER' && (
              <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '2px solid var(--primary)',
                      background: '#fff',
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#555' }}>Busy</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '2px solid #1a7a2f',
                      background: '#1a7a2f',
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#555' }}>Free</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: '2px solid #6a1b9a',
                      background: '#6a1b9a',
                    }}
                  />
                  <span style={{ fontSize: '13px', color: '#555' }}>Office Hours</span>
                </div>
              </div>
            )}

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '8px 12px', fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Period</th>
                    {DAYS.map((day) => (
                      <th key={day} style={{ padding: '8px 12px', color: PRIMARY, fontWeight: 700, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Day {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period) => (
                    <tr key={period}>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{period === 'BREAK' ? 'Break' : period}</td>
                      {DAYS.map((day) => {
                        const key = `${day}-${period}`;

                        if (role === 'TEACHER') {
                          const state = slotStates.get(key);
                          let bg = '#fff';
                          let color = PRIMARY;
                          let label = 'Busy';
                          if (state === 'FREE') {
                            bg = '#1a7a2f';
                            color = '#fff';
                            label = 'Free';
                          } else if (state === 'OFFICE_HOURS') {
                            bg = '#6a1b9a';
                            color = '#fff';
                            label = 'OH';
                          }
                          return (
                            <td key={key} style={{ padding: '8px 12px' }}>
                              <button
                                type="button"
                                onClick={() => cycleSlot(day, period)}
                                disabled={isViewOnly}
                                style={{
                                  width: '100%',
                                  padding: '12px 0',
                                  borderRadius: '8px',
                                  border: '2px solid var(--primary)',
                                  backgroundColor: bg,
                                  color,
                                  fontWeight: 700,
                                  cursor: isViewOnly ? 'default' : 'pointer',
                                }}
                              >
                                {label}
                              </button>
                            </td>
                          );
                        }

                        // Student/Admin: binary toggle
                        const active = selectedSlots.has(key);
                        return (
                          <td key={key} style={{ padding: '8px 12px' }}>
                            <button
                              type="button"
                              onClick={() => toggleSlot(day, period)}
                              disabled={isViewOnly}
                              style={{
                                width: '100%',
                                padding: '12px 0',
                                borderRadius: '8px',
                                border: '2px solid var(--primary)',
                                backgroundColor: active ? PRIMARY : '#fff',
                                color: active ? '#fff' : PRIMARY,
                                fontWeight: 700,
                                cursor: isViewOnly ? 'default' : 'pointer',
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

        {!isViewOnly && (
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            style={{
              marginTop: '24px',
              padding: '16px 24px',
              fontSize: '15px',
              backgroundColor: PRIMARY,
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              width: '100%',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 700,
            }}
          >
            Logout
          </button>
        )}
      </div>

      {message && <p style={{ marginTop: '20px', color: PRIMARY }}>{message}</p>}
    </div>
  );
}
