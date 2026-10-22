'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { signOut } from 'next-auth/react';
import { DAYS, PERIODS, type PeriodValue } from '@/src/config/schedule';

type FreePeriod = {
  day: number;
  period: PeriodValue;
  type?: string;
};

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

type SlotState = 'FREE' | 'OFFICE_HOURS';

export default function SetNamePage() {
  const [fullName, setFullName] = useState('');
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(new Set());
  const [slotStates, setSlotStates] = useState<Map<string, SlotState>>(new Map());
  const [defaultRoom, setDefaultRoom] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [lastSavedKey, setLastSavedKey] = useState('');
  // Key of the last failed save; don't retry it until the user edits again,
  // otherwise a 429/5xx turns the effect into an endless POST loop.
  const [failedKey, setFailedKey] = useState('');
  const [hasInitialized, setHasInitialized] = useState(false);
  const [role, setRole] = useState<'STUDENT' | 'TEACHER' | 'ADMIN'>('STUDENT');
  const isHost = role === 'TEACHER' || role === 'ADMIN';
  // Teachers must set a room before their grid appears; it's optional for
  // admins, many of whom don't teach.
  const needsRoom = role === 'TEACHER' && !defaultRoom.trim();

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
      const oauthName = session?.user?.name ?? '';
      const resolvedName = oauthName || data?.fullName || nameFromEmail(email);
      const resolvedRole = data?.role ?? 'STUDENT';
      setFullName(resolvedName);
      setRole(resolvedRole);

      // Admins use the teacher-style grid too: some of them teach, and these
      // periods are what students can book.
      if (resolvedRole === 'TEACHER' || resolvedRole === 'ADMIN') {
        const stateMap = new Map<string, SlotState>();
        if (Array.isArray(data?.teacher?.availability)) {
          for (const slot of data.teacher.availability) {
            const key = `${slot.day}-${slot.period}`;
            stateMap.set(key, slot.type === 'OFFICE_HOURS' ? 'OFFICE_HOURS' : 'FREE');
          }
        }
        // Teachers start with breaks free. Admins start empty so an admin who
        // doesn't teach never becomes bookable by accident.
        if (stateMap.size === 0 && resolvedRole === 'TEACHER') {
          for (const day of DAYS) {
            stateMap.set(`${day}-BREAK`, 'FREE');
          }
        }
        setSlotStates(stateMap);
        setDefaultRoom(data?.teacher?.room ?? '');
        setLastSavedKey(buildTeacherSaveKey(resolvedName, stateMap, data?.teacher?.room ?? ''));
      } else {
        let initialSlots: FreePeriod[] = [];
        if (Array.isArray(data?.studentAvailability)) {
          initialSlots = data.studentAvailability;
        }
        const initialSet = new Set(
          initialSlots.map((slot: FreePeriod) => `${slot.day}-${slot.period}`)
        );
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

  const cycleSlot = (day: number, period: PeriodValue) => {
    setSlotStates((prev) => {
      const next = new Map(prev);
      const key = `${day}-${period}`;
      const current = next.get(key);
      if (!current) {
        next.set(key, 'FREE');
      } else if (current === 'FREE') {
        next.set(key, 'OFFICE_HOURS');
      } else {
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
      isHost
        ? buildTeacherSaveKey(trimmedName, slotStates, defaultRoom)
        : buildStudentSaveKey(trimmedName, selectedSlots);

    if (currentKey === lastSavedKey || currentKey === failedKey) return;
    if (saving) return;

    const timeout = setTimeout(async () => {
      setSaving(true);
      setMessage('Saving...');

      try {
        let freePeriods: FreePeriod[];
        if (isHost) {
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

        if (isHost) {
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
          isHost
            ? buildTeacherSaveKey(trimmedName, slotStates, defaultRoom)
            : buildStudentSaveKey(trimmedName, selectedSlots);
        if (latestKey === currentKey) {
          setLastSavedKey(latestKey);
          setMessage('All changes saved.');
        }
      } catch (error) {
        setFailedKey(currentKey);
        setMessage(`Error saving profile: ${error}`);
      } finally {
        setSaving(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [fullName, selectedSlots, slotStates, defaultRoom, status, loadingProfile, hasInitialized, lastSavedKey, failedKey, saving, isHost]);

  if (status === 'loading' || loadingProfile) {
    return (
      <div style={{ padding: '48px 40px', maxWidth: '960px', margin: '0 auto' }}>
        <div className="skeleton" style={{ height: '36px', width: '220px', marginBottom: '32px' }} />
        <div style={{ background: 'var(--surface-warm)', borderRadius: '14px', padding: '28px', marginBottom: '24px' }}>
          <div className="skeleton" style={{ height: '44px', width: '100%', marginBottom: '12px' }} />
          <div className="skeleton" style={{ height: '44px', width: '100%' }} />
        </div>
        <div style={{ background: 'var(--surface-warm)', borderRadius: '14px', padding: '28px' }}>
          <div className="skeleton" style={{ height: '200px', width: '100%' }} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '48px 40px', maxWidth: '960px', margin: '0 auto' }}>
      <h1 style={{
        fontFamily: 'var(--font-lora, Georgia, serif)',
        fontSize: '32px',
        fontWeight: 700,
        color: 'var(--primary)',
        marginBottom: '32px',
        letterSpacing: '-0.02em',
      }}>
        Account settings
      </h1>

      {/* Profile info card */}
      <div style={{
        borderRadius: '14px',
        padding: '24px 28px',
        marginBottom: '24px',
        background: 'var(--surface)',
        boxShadow: '0 1px 3px rgba(91,13,31,0.04), 0 4px 20px rgba(91,13,31,0.06)',
        border: '1px solid var(--border-light)',
      }}>
        <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12px', letterSpacing: '0.03em', color: 'var(--muted)' }}>
              Full name
            </label>
            <input
              type="text"
              value={fullName}
              disabled
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-warm)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12px', letterSpacing: '0.03em', color: 'var(--muted)' }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              disabled
              style={{
                width: '100%',
                padding: '10px 14px',
                fontSize: '14px',
                border: '1px solid var(--border-light)',
                borderRadius: '8px',
                backgroundColor: 'var(--surface-warm)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12px', letterSpacing: '0.03em', color: 'var(--muted)' }}>
              Role
            </label>
            <div style={{
              padding: '10px 14px',
              fontSize: '14px',
              border: '1px solid var(--border-light)',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-warm)',
              fontWeight: 600,
            }}>
              {role}
            </div>
          </div>
        </div>

        {/* Default Room input for hosts (teachers and admins) */}
        {isHost && (
          <div style={{ marginTop: '16px' }}>
            <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '12px', letterSpacing: '0.03em', color: 'var(--muted)' }}>
              Default room (for office hours)
            </label>
            <input
              type="text"
              value={defaultRoom}
              onChange={(e) => setDefaultRoom(e.target.value)}
              placeholder="e.g. 315L"
              style={{
                width: '100%',
                maxWidth: '280px',
                padding: '10px 14px',
                fontSize: '14px',
                border: needsRoom ? '2px solid var(--danger)' : '1px solid var(--border)',
                borderRadius: '8px',
                boxShadow: needsRoom ? '0 0 0 3px rgba(185, 28, 28, 0.1)' : undefined,
              }}
            />
            {needsRoom ? (
              <p style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 600, marginTop: '4px' }}>
                Room number is required to set your schedule
              </p>
            ) : (
              <p style={{ color: 'var(--muted)', fontSize: '12px', marginTop: '4px' }}>
                This room will be auto-filled when students book your office hours.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Teacher needs room before showing schedule */}
      {needsRoom && (
        <div style={{
          borderRadius: '14px',
          padding: '28px',
          background: 'var(--surface-warm)',
          border: '1px solid var(--border-light)',
          color: 'var(--muted)',
          fontWeight: 500,
          fontSize: '14px',
        }}>
          Set your room number above to configure your schedule.
        </div>
      )}

      {/* Schedule grid */}
      {!needsRoom && (
        <div style={{
          borderRadius: '14px',
          padding: '28px',
          background: 'var(--surface)',
          boxShadow: '0 1px 3px rgba(91,13,31,0.04), 0 4px 20px rgba(91,13,31,0.06)',
          border: '1px solid var(--border-light)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-lora, Georgia, serif)',
            fontSize: '20px',
            fontWeight: 600,
            marginBottom: '6px',
            color: 'var(--foreground)',
          }}>
            {isHost ? 'Select your available periods' : 'Select your free periods'}
          </h2>
          <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '20px' }}>
            {role === 'TEACHER'
              ? 'Tap the periods you are available to meet. Students will only see periods you select.'
              : role === 'ADMIN'
              ? 'Tap a slot to mark it as free, tap it again to mark it as an office hours.'
              : 'Tap the periods you are available to meet. This will be used to match with teacher availability.'}
          </p>

          {/* Color legend for teachers */}
          {isHost && (
            <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '4px', border: '2px solid var(--border)', background: 'var(--surface)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Busy</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--slot-match)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Free</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: 'var(--slot-oh)' }} />
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Office hours</span>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '6px 8px', fontWeight: 600, fontSize: '12px', letterSpacing: '0.03em', color: 'var(--muted)' }}>Period</th>
                  {DAYS.map((day) => (
                    <th key={day} style={{ padding: '6px 8px', color: 'var(--primary)', fontWeight: 600, fontSize: '12px', letterSpacing: '0.03em' }}>
                      Day {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERIODS.map((period) => (
                  <tr key={period}>
                    <td style={{ padding: '4px 8px', fontWeight: 600, fontSize: '13px', color: 'var(--foreground)' }}>{period === 'BREAK' ? 'Break' : period}</td>
                    {DAYS.map((day) => {
                      const key = `${day}-${period}`;

                      if (isHost) {
                        const state = slotStates.get(key);
                        let bg = 'var(--surface)';
                        let color = 'var(--muted)';
                        let label = 'Busy';
                        let borderColor = 'var(--border)';
                        if (state === 'FREE') {
                          bg = 'var(--slot-match)';
                          color = '#fff';
                          label = 'Free';
                          borderColor = 'var(--slot-match)';
                        } else if (state === 'OFFICE_HOURS') {
                          bg = 'var(--slot-oh)';
                          color = '#fff';
                          label = 'OH';
                          borderColor = 'var(--slot-oh)';
                        }
                        return (
                          <td key={key} style={{ padding: '3px 4px' }}>
                            <button
                              type="button"
                              className="slot-btn"
                              onClick={() => cycleSlot(day, period)}
                              style={{
                                width: '100%',
                                padding: '6px 0',
                                borderRadius: '6px',
                                border: `2px solid ${borderColor}`,
                                fontSize: '12px',
                                backgroundColor: bg,
                                color,
                                fontWeight: 600,
                                cursor: 'pointer',
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
                        <td key={key} style={{ padding: '4px 6px' }}>
                          <button
                            type="button"
                            className="slot-btn"
                            onClick={() => toggleSlot(day, period)}
                            style={{
                              width: '100%',
                              padding: '8px 0',
                              borderRadius: '6px',
                              border: active ? '2px solid var(--primary)' : '2px solid var(--border)',
                              backgroundColor: active ? 'var(--primary)' : 'var(--surface)',
                              color: active ? '#fff' : 'var(--muted)',
                              fontWeight: 600,
                              fontSize: '12px',
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
        className="btn-fill"
        onClick={() => signOut({ callbackUrl: '/login' })}
        style={{
          marginTop: '24px',
          padding: '12px 20px',
          fontSize: '14px',
          backgroundColor: 'var(--primary)',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          fontWeight: 600,
        }}
      >
        Logout
      </button>

      {message && (
        <p style={{
          marginTop: '16px',
          color: message.startsWith('Error') ? 'var(--danger)' : 'var(--primary)',
          fontSize: '14px',
          fontWeight: 500,
        }}>
          {message}
        </p>
      )}
    </div>
  );
}
