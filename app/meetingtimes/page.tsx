"use client";

import * as React from "react";
import { database } from '@/firebase';
import { ref, onValue, push, set } from 'firebase/database';
import { useSearchParams } from 'next/navigation';

type TimeSlot = {
  id: string;
  startMin: number;
  endMin: number;
  label: string;
  day: number;
  duration: number;
};

type FreePeriod = {
  day: number;
  start: string;
  end: string;
};

const COLORS = {
  maroon: "#5b0d1f",
  lightGray: "#e9e9e9",
  midGray: "#d9d9d9",
  text: "#1b1b1b",
};

function classNames(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(" ");
}

function timeStringToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(mins: number) {
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12raw = h24 % 12;
  const h12 = h12raw === 0 ? 12 : h12raw;
  const mm = m.toString().padStart(2, "0");
  return `${h12}:${mm} ${ampm}`;
}

function formatRange(startMin: number, endMin: number) {
  return `${formatTime(startMin)} - ${formatTime(endMin)}`;
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
      <button className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close modal" />
      <div className="relative w-full max-w-xl">{children}</div>
    </div>
  );
}

export default function MeetingTimesPage() {
  const searchParams = useSearchParams();
  const selectedPersonName = searchParams.get('person');
  const currentUserId = 'user1'; // Change to 'user2' on your second device for testing
  
  const [myFrees, setMyFrees] = React.useState<FreePeriod[]>([]);
  const [theirFrees, setTheirFrees] = React.useState<FreePeriod[]>([]);
  const [selectedDay, setSelectedDay] = React.useState<number>(1);
  const [selectedSlot, setSelectedSlot] = React.useState<TimeSlot | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [allPeople, setAllPeople] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [userEmail, setUserEmail] = React.useState('');
  const [userName, setUserName] = React.useState('');
  const [allEmails, setAllEmails] = React.useState<Record<string, string>>({});

  // Load all people names, emails, and their user IDs
  React.useEffect(() => {
    const namesRef = ref(database, 'names');
    const unsubscribe = onValue(namesRef, (snapshot) => {
      if (snapshot.exists()) {
        const namesData = snapshot.val();
        const peopleMap: Record<string, string> = {};
        const emailsMap: Record<string, string> = {};
        Object.entries(namesData).forEach(([userId, data]: [string, any]) => {
          peopleMap[data.name] = userId;
          emailsMap[data.name] = data.email || '';
          // Get current user's info
          if (userId === currentUserId) {
            setUserName(data.name || '');
            setUserEmail(data.email || '');
          }
        });
        setAllPeople(peopleMap);
        setAllEmails(emailsMap);
        console.log('People loaded:', peopleMap);
        console.log('Emails loaded:', emailsMap);
      }
    });
    return () => unsubscribe();
  }, [currentUserId]);

  // Load my frees
  React.useEffect(() => {
    const freesRef = ref(database, `freeTimes/${currentUserId}`);
    const unsubscribe = onValue(freesRef, (snapshot) => {
      if (snapshot.exists()) {
        const periods = snapshot.val().periods || [];
        setMyFrees(periods);
        console.log('My frees:', periods);
      } else {
        console.log(`No frees found for ${currentUserId}`);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentUserId]);

  // Load their frees
  React.useEffect(() => {
    if (!selectedPersonName || !allPeople[selectedPersonName]) {
      console.log('Waiting for person selection or people data');
      return;
    }
    
    const theirUserId = allPeople[selectedPersonName];
    console.log(`Loading frees for ${selectedPersonName} (${theirUserId})`);
    
    const freesRef = ref(database, `freeTimes/${theirUserId}`);
    const unsubscribe = onValue(freesRef, (snapshot) => {
      if (snapshot.exists()) {
        const periods = snapshot.val().periods || [];
        setTheirFrees(periods);
        console.log(`${selectedPersonName}'s frees:`, periods);
      } else {
        console.log(`No frees found for ${selectedPersonName}`);
        setTheirFrees([]);
      }
    });
    return () => unsubscribe();
  }, [selectedPersonName, allPeople]);

  // Find ALL common free slots across all days - for Top 3
  const allCommonFreeSlots = React.useMemo(() => {
    const slots: TimeSlot[] = [];
    
    // Loop through all days
    for (let day = 1; day <= 10; day++) {
      const myDayFrees = myFrees.filter(f => f.day === day);
      const theirDayFrees = theirFrees.filter(f => f.day === day);
      
      // For each of my free periods
      myDayFrees.forEach(myFree => {
        const myStart = timeStringToMinutes(myFree.start);
        const myEnd = timeStringToMinutes(myFree.end);
        
        // Check each of their free periods
        theirDayFrees.forEach(theirFree => {
          const theirStart = timeStringToMinutes(theirFree.start);
          const theirEnd = timeStringToMinutes(theirFree.end);
          
          // Find overlap
          const overlapStart = Math.max(myStart, theirStart);
          const overlapEnd = Math.min(myEnd, theirEnd);
          
          // If there's an overlap
          if (overlapStart < overlapEnd) {
            const duration = overlapEnd - overlapStart;
            slots.push({
              id: `${day}-${overlapStart}-${overlapEnd}`,
              startMin: overlapStart,
              endMin: overlapEnd,
              label: formatRange(overlapStart, overlapEnd),
              day: day,
              duration: duration,
            });
          }
        });
      });
    }
    
    // Sort by duration (longest first), take top 3
    const top3Longest = slots.sort((a, b) => b.duration - a.duration).slice(0, 3);
    console.log('Top 3 longest slots across all days:', top3Longest);
    
    return top3Longest;
  }, [myFrees, theirFrees]);

  // Find intersection of free times for selected day only
  const dayCommonFreeSlots = React.useMemo(() => {
    const myDayFrees = myFrees.filter(f => f.day === selectedDay);
    const theirDayFrees = theirFrees.filter(f => f.day === selectedDay);
    
    console.log(`Day ${selectedDay} - My frees:`, myDayFrees);
    console.log(`Day ${selectedDay} - Their frees:`, theirDayFrees);
    
    const slots: TimeSlot[] = [];
    
    // For each of my free periods
    myDayFrees.forEach(myFree => {
      const myStart = timeStringToMinutes(myFree.start);
      const myEnd = timeStringToMinutes(myFree.end);
      
      // Check each of their free periods
      theirDayFrees.forEach(theirFree => {
        const theirStart = timeStringToMinutes(theirFree.start);
        const theirEnd = timeStringToMinutes(theirFree.end);
        
        // Find overlap
        const overlapStart = Math.max(myStart, theirStart);
        const overlapEnd = Math.min(myEnd, theirEnd);
        
        // If there's an overlap
        if (overlapStart < overlapEnd) {
          const duration = overlapEnd - overlapStart;
          slots.push({
            id: `${selectedDay}-${overlapStart}-${overlapEnd}`,
            startMin: overlapStart,
            endMin: overlapEnd,
            label: formatRange(overlapStart, overlapEnd),
            day: selectedDay,
            duration: duration,
          });
        }
      });
    });
    
    // Sort chronologically
    const chronological = slots.sort((a, b) => a.startMin - b.startMin);
    console.log('Day slots (chronological):', chronological);
    
    return chronological;
  }, [myFrees, theirFrees, selectedDay]);

  const headerTitle = `Meeting Times with ${selectedPersonName || 'Unknown'} - Day ${selectedDay}`;

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-white p-6 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white p-6" style={{ color: COLORS.text }}>
      <div className="mx-auto w-full max-w-4xl">
        {/* Header */}
        <div className="mb-3 flex items-center gap-3">
          <button
            type="button"
            className={classNames("text-sm font-medium", "rounded-md px-2 py-1", "border")}
            style={{ borderColor: COLORS.midGray, color: COLORS.text }}
            onClick={() => window.history.back()}
          >
            &lt; Back
          </button>
          <h1 className="text-lg font-semibold">{headerTitle}</h1>
        </div>

        {/* Debug info */}
        <div className="mb-3 text-xs" style={{ color: "#888" }}>
          Selected person: {selectedPersonName || 'None'} | 
          My frees: {myFrees.length} | 
          Their frees: {theirFrees.length} |
          My email: {userEmail || 'Not set'}
        </div>

        {/* Top 3 Available Meeting Times */}
        <div
          className="mb-3 rounded-lg border p-3"
          style={{ borderColor: COLORS.maroon, boxShadow: "0 1px 0 rgba(0,0,0,0.03)" }}
        >
          <div className="mb-2 text-sm font-semibold" style={{ color: COLORS.text }}>
            Top 3 Available Meeting Times
          </div>

          {allCommonFreeSlots.length === 0 ? (
            <div className="text-sm" style={{ color: "#5a5a5a" }}>
              No common available meeting times.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {allCommonFreeSlots.map((s) => (
                <button
                  key={`top-${s.id}`}
                  type="button"
                  className="rounded-md border px-3 py-2 text-left text-sm font-medium"
                  style={{
                    borderColor: COLORS.midGray,
                    background: COLORS.lightGray,
                    color: COLORS.text,
                  }}
                  onClick={() => {
                    setSelectedDay(s.day);
                    setSelectedSlot(s);
                    setConfirmOpen(true);
                  }}
                >
                  <div className="text-xs font-semibold" style={{ color: "#5a5a5a" }}>
                    Day {s.day}
                  </div>
                  <div>{s.label}</div>
                  <div className="text-xs" style={{ color: "#5a5a5a" }}>
                    ({s.duration} min)
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Card */}
        <div
          className="rounded-lg border p-3"
          style={{
            borderColor: COLORS.maroon,
            boxShadow: "0 1px 0 rgba(0,0,0,0.03)",
          }}
        >
          <div className="grid grid-cols-12 gap-3">
            {/* Day selector */}
            <div className="col-span-12 sm:col-span-4">
              <div className="rounded-md border" style={{ borderColor: COLORS.maroon }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((day, idx) => {
                  const active = day === selectedDay;

                  return (
                    <button
                      key={day}
                      type="button"
                      className={classNames(
                        "w-full text-left",
                        "px-3 py-2",
                        "text-sm font-semibold",
                        "transition-colors",
                        idx !== 0 && "border-t"
                      )}
                      style={{
                        borderTopColor: COLORS.maroon,
                        background: active ? COLORS.maroon : "#ffffff",
                        color: active ? "#ffffff" : COLORS.text,
                      }}
                      onClick={() => {
                        setSelectedDay(day);
                        setSelectedSlot(null);
                      }}
                    >
                      Day {day}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Availability list */}
            <div className="col-span-12 sm:col-span-8">
              <p className="mb-2 text-xs leading-4" style={{ color: "#5a5a5a" }}>
                All common free times on Day {selectedDay} with {selectedPersonName}
              </p>

              <div className="space-y-2">
                {dayCommonFreeSlots.length > 0 ? (
                  dayCommonFreeSlots.map((slot) => (
                    <button
                      key={slot.id}
                      type="button"
                      className="w-full rounded-md border px-3 py-2 text-left text-sm font-medium"
                      style={{
                        borderColor: COLORS.midGray,
                        background: COLORS.lightGray,
                        color: COLORS.text,
                      }}
                      onClick={() => {
                        setSelectedSlot(slot);
                        setConfirmOpen(true);
                      }}
                    >
                      {slot.label} ({slot.duration} min)
                    </button>
                  ))
                ) : (
                  <p className="text-sm" style={{ color: "#5a5a5a" }}>
                    No common free times on this day.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      <Modal
        open={confirmOpen}
        onClose={() => {
          setConfirmOpen(false);
        }}
      >
        <div className="rounded-lg bg-white p-6 shadow-xl">
          <h2 className="mb-3 text-xl font-semibold">Schedule Meeting?</h2>

          <p className="mb-6 text-sm">
            Schedule a meeting with {selectedPersonName} for Day {selectedDay}: {selectedSlot ? selectedSlot.label : ""}?
          </p>

          <p className="mb-6 text-xs" style={{ color: "#666" }}>
            You will receive a confirmation email, and {selectedPersonName} will be notified.
          </p>

          <div className="flex items-center justify-start gap-4">
            <button
              type="button"
              className="rounded-md px-6 py-2 text-sm font-semibold text-white"
              style={{ background: COLORS.maroon }}
              onClick={async () => {
                if (!userEmail) {
                  alert('Please set up your email in your profile first!');
                  return;
                }

                const personEmail = selectedPersonName ? allEmails[selectedPersonName] : '';
                if (!personEmail) {
                  alert('The selected person does not have an email set up!');
                  return;
                }

                const theirUserId = selectedPersonName ? allPeople[selectedPersonName] : null;
                if (!theirUserId) {
                  alert('Could not find user ID!');
                  return;
                }

                try {
                  console.log('Attempting to save meeting...');
                  console.log('Current user:', currentUserId);
                  console.log('Other user:', theirUserId);
                  
                  const meetingData = {
                    withName: selectedPersonName,
                    withUserId: theirUserId,
                    fromName: userName,
                    fromUserId: currentUserId,
                    day: selectedDay,
                    time: selectedSlot?.label,
                    status: 'pending',
                    timestamp: Date.now()
                  };

                  console.log('Meeting data:', meetingData);

                  // Save to both users' pending meetings
                  const myPendingRef = push(ref(database, `pendingMeetings/${currentUserId}`));
                  await set(myPendingRef, meetingData);
                  console.log('Saved to my pending meetings');

                  const theirPendingRef = push(ref(database, `pendingMeetings/${theirUserId}`));
                  await set(theirPendingRef, meetingData);
                  console.log('Saved to their pending meetings');

                  // Send both confirmation and notification emails
                  const response = await fetch('/api/send-meeting-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      personName: selectedPersonName,
                      personEmail: personEmail,
                      day: selectedDay,
                      timeLabel: selectedSlot?.label,
                      userEmail: userEmail,
                      userName: userName || 'Student'
                    })
                  });

                  if (response.ok) {
                    console.log('Emails sent successfully');
                    alert(`Meeting request sent!\n\nYou will receive a confirmation email, and ${selectedPersonName} will be notified.`);
                  } else {
                    console.log('Email send failed');
                    alert('Request saved but failed to send emails.');
                  }
                } catch (error) {
                  console.error('Error:', error);
                  alert('Failed to send meeting request: ' + error);
                }
                
                setConfirmOpen(false);
              }}
            >
              Yes, Schedule
            </button>
            <button
              type="button"
              className="rounded-md px-6 py-2 text-sm font-semibold text-white"
              style={{ background: COLORS.maroon }}
              onClick={() => {
                setConfirmOpen(false);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}