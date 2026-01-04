"use client";

import React, { useState, ChangeEvent, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { database } from '@/firebase';
import { ref, onValue, remove, push, set, get } from 'firebase/database';

interface Meeting {
  time: string;
  with: string;
}

type FreePeriod = {
  day: number;
  start: string;
  end: string;
};

export default function ProfilePage() {
  const currentUserId = 'user1'; // Change to 'user2' on second device
  
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("Brighten Sun");
  const [bio, setBio] = useState("No Bio Yet");
  const [avatarBg, setAvatarBg] = useState<string>('#8B5CF6');
  const [frees, setFrees] = useState<FreePeriod[]>([]);
  const [pendingMeetings, setPendingMeetings] = useState<any[]>([]);
  const [confirmedMeetings, setConfirmedMeetings] = useState<any[]>([]);
  const router = useRouter();

  const createEmptySchedule = () => {
    return Array(8).fill(null).map(() => Array(10).fill(''));
  };

  const [schedule, setSchedule] = useState<string[][]>(() => createEmptySchedule());

  const periodTimes = [
    "8:25 am",
    "9:15 am",
    "10:00 am",  // Break
    "10:20 am",
    "11:10 am",
    "12:00 pm",
    "12:50 pm",
    "1:40 pm",
    "2:30 pm"
  ];

  const periodLabels = ['A', 'B', '', 'C', 'D', 'E', 'F', 'G', 'H'];

  // Load Firebase data
  useEffect(() => {
    const freesRef = ref(database, `freeTimes/${currentUserId}`);
    const unsubscribeFrees = onValue(freesRef, (snapshot) => {
      if (snapshot.exists()) {
        setFrees(snapshot.val().periods || []);
      }
    });

    const nameRef = ref(database, `names/${currentUserId}`);
    const unsubscribeName = onValue(nameRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseName = snapshot.val().name;
        if (firebaseName) {
          setStudentName(firebaseName);
        }
      }
    });

    // Load pending meetings
    const pendingRef = ref(database, `pendingMeetings/${currentUserId}`);
    const unsubscribePending = onValue(pendingRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const arr = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        setPendingMeetings(arr);
      } else {
        setPendingMeetings([]);
      }
    });

    // Load confirmed meetings
    const confirmedRef = ref(database, `confirmedMeetings/${currentUserId}`);
    const unsubscribeConfirmed = onValue(confirmedRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const arr = Object.entries(data).map(([key, value]: [string, any]) => ({
          id: key,
          ...value
        }));
        setConfirmedMeetings(arr);
      } else {
        setConfirmedMeetings([]);
      }
    });

    return () => {
      unsubscribeFrees();
      unsubscribeName();
      unsubscribePending();
      unsubscribeConfirmed();
    };
  }, [currentUserId]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('profileData');
    if (saved) {
      const data = JSON.parse(saved);
      setBio(data.bio ?? "No Bio Yet");
      setProfileImage(data.profileImage ?? null);
      setSchedule(data.schedule ?? createEmptySchedule());
      setAvatarBg(data.avatarBg ?? '#8B5CF6');
    } else {
      const newColor = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6'][Math.floor(Math.random() * 8)];
      setAvatarBg(newColor);
    }
  }, []);

  useEffect(() => {
    const data = {
      bio,
      profileImage,
      schedule,
      avatarBg,
    };
    localStorage.setItem('profileData', JSON.stringify(data));
  }, [bio, profileImage, schedule, avatarBg]);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
    }
  };

  const avatarLetter = studentName.charAt(0).toUpperCase() || '?';

  const confirmMeeting = async (meetingId: string, meeting: any) => {
    try {
      const otherPersonName = meeting.withName;
      const otherPersonUserId = meeting.withUserId;
      
      // Remove from sender's pending meetings
      await remove(ref(database, `pendingMeetings/${currentUserId}/${meetingId}`));

      // Add to confirmed for both users
      const confirmedData = {
        ...meeting,
        status: 'confirmed',
        confirmedAt: Date.now(),
        confirmedBy: currentUserId
      };

      const myConfirmedRef = push(ref(database, `confirmedMeetings/${currentUserId}`));
      await set(myConfirmedRef, {
        ...confirmedData,
        with: otherPersonName
      });
      
      const theirConfirmedRef = push(ref(database, `confirmedMeetings/${otherPersonUserId}`));
      await set(theirConfirmedRef, {
        ...confirmedData,
        with: studentName
      });

      alert(`Meeting with ${otherPersonName} confirmed!`);
    } catch (error) {
      console.error('Error confirming meeting:', error);
      alert('Failed to confirm meeting');
    }
  };

  // Helper function to convert time string to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    let cleanTime = timeStr.toLowerCase().trim();
    
    // If it has am/pm, parse it
    if (cleanTime.includes('am') || cleanTime.includes('pm')) {
      const isPM = cleanTime.includes('pm');
      cleanTime = cleanTime.replace(/am|pm/g, '').trim();
      const [hours, minutes] = cleanTime.split(':').map(Number);
      let hour24 = hours;
      if (isPM && hours !== 12) hour24 += 12;
      if (!isPM && hours === 12) hour24 = 0;
      return hour24 * 60 + minutes;
    } else {
      // 24-hour format like "09:15"
      const [hours, minutes] = cleanTime.split(':').map(Number);
      return hours * 60 + minutes;
    }
  };

  // Define period ranges
  const periodRanges = [
    { start: "8:25 am", end: "9:15 am" },   // Period A
    { start: "9:15 am", end: "10:00 am" },  // Period B
    { start: "10:00 am", end: "10:20 am" }, // Break
    { start: "10:20 am", end: "11:05 am" }, // Period C
    { start: "11:10 am", end: "11:55 am" }, // Period D
    { start: "12:00 pm", end: "12:45 pm" }, // Period E
    { start: "12:50 pm", end: "1:35 pm" },  // Period F
    { start: "1:40 pm", end: "2:25 pm" },   // Period G
    { start: "2:30 pm", end: "3:15 pm" },   // Period H
  ];

  const renderRow = (rowIndex: number, weekCols: number[]) => {
    const isBreakRow = rowIndex === 2;

    return (
      <React.Fragment key={rowIndex}>
        <div style={{ fontWeight: 'bold', textAlign: 'right', paddingRight: '10px' }}>
          {isBreakRow ? 'Break' : periodLabels[rowIndex]}
        </div>
        <div style={{ fontSize: '14px', color: '#555' }}>
          {periodTimes[rowIndex]}
        </div>
        {weekCols.map(col => {
          const dayNum = col + 1;
          
          // Check if this specific period overlaps with any free time for this day
          const period = periodRanges[rowIndex];
          const periodStart = timeToMinutes(period.start);
          const periodEnd = timeToMinutes(period.end);
          
          const overlappingFrees = frees.filter(free => {
            if (free.day !== dayNum) return false;
            const freeStart = timeToMinutes(free.start);
            const freeEnd = timeToMinutes(free.end);
            // Check for overlap
            return freeStart < periodEnd && freeEnd > periodStart;
          });
          
          return isBreakRow ? (
            <div
              key={col}
              style={{
                backgroundColor: '#555',
                color: 'white',
                padding: '14px',
                borderRadius: '12px',
                minHeight: '50px',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Break
            </div>
          ) : (
            <div
              key={col}
              style={{
                position: 'relative',
                backgroundColor: '#800000',
                color: 'white',
                padding: '14px',
                borderRadius: '12px',
                minHeight: '50px',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Class
              {/* Show green overlay if this period overlaps with any free time */}
              {overlappingFrees.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: '#90EE90',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '12px',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}
                >
                  <div>Free</div>
                  <div style={{ fontSize: '11px', marginTop: '4px' }}>
                    {overlappingFrees[0].start} - {overlappingFrees[0].end}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </React.Fragment>
    );
  };

  return (
    <div style={{ fontFamily: 'sans-serif', maxWidth: '1400px', margin: '0 auto', padding: '20px' }}>
      {/* Profile Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: '30px' }}>
        <label htmlFor="profile-upload">
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '20px',
              background: profileImage ? `url(${profileImage}) center/cover` : avatarBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              marginRight: '20px',
              fontSize: '40px',
              color: 'white',
              fontWeight: 'bold',
            }}
          >
            {!profileImage && avatarLetter}
          </div>
        </label>
        <input id="profile-upload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageUpload} />

        <div style={{ flex: 1 }}>
          <input
            type="text"
            value={studentName}
            onChange={(e) => setStudentName(e.target.value)}
            style={{
              fontSize: '32px',
              fontWeight: 'bold',
              border: 'none',
              background: 'transparent',
              marginBottom: '12px',
              display: 'block',
            }}
          />
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            placeholder="Write something about yourself..."
            style={{
              fontSize: '18px',
              border: '1px solid #ccc',
              borderRadius: '8px',
              padding: '12px',
              background: 'transparent',
              color: '#333',
              width: '100%',
              resize: 'vertical',
            }}
          />
        </div>
      </div>

      {/* Schedule Meeting Button */}
      <div
        style={{
          backgroundColor: '#f0f0f0',
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '30px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          fontSize: '18px',
          fontWeight: '500',
        }}
      >
        <span>Schedule Meeting</span>
        <span style={{ fontSize: '20px' }}>▼</span>
      </div>

      {/* Debug Info */}
      <div style={{ backgroundColor: '#f0f0f0', padding: '10px', borderRadius: '4px', marginBottom: '20px', fontSize: '12px' }}>
        <strong>Debug Info:</strong><br />
        Current User ID: {currentUserId}<br />
        Pending Meetings Count: {pendingMeetings.length}<br />
        Pending Data: {JSON.stringify(pendingMeetings, null, 2)}<br />
        Confirmed Meetings Count: {confirmedMeetings.length}
      </div>

      {/* Pending Meetings */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
          Pending Meetings ({pendingMeetings.length})
        </h3>
        <div style={{ backgroundColor: '#fff3cd', padding: '16px', borderRadius: '8px', border: '1px solid #ffc107' }}>
          {pendingMeetings.length > 0 ? (
            pendingMeetings.map((meeting) => {
              return (
                <div key={meeting.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '4px' }}>
                  <div style={{ flex: 1 }}>
                    <strong>Meeting with {meeting.withName}</strong>
                    <div style={{ fontSize: '14px', color: '#666' }}>
                      Day {meeting.day}, {meeting.time}
                    </div>
                    <div style={{ fontSize: '12px', color: '#999' }}>
                      Waiting for confirmation
                    </div>
                  </div>
                  <button
                    onClick={() => confirmMeeting(meeting.id, meeting)}
                    style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '500' }}
                  >
                    Confirm
                  </button>
                </div>
              );
            })
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              No pending meetings
            </div>
          )}
        </div>
      </div>

      {/* Confirmed Meetings */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
          Confirmed Meetings
        </h3>
        <div style={{ backgroundColor: '#d1fae5', padding: '16px', borderRadius: '8px', border: '1px solid #10b981' }}>
          {confirmedMeetings.length > 0 ? (
            confirmedMeetings.map((meeting) => (
              <div key={meeting.id} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center', backgroundColor: 'white', padding: '12px', borderRadius: '4px' }}>
                <div style={{ flex: 1 }}>
                  <strong>Meeting with {meeting.with}</strong>
                  <div style={{ fontSize: '14px', color: '#666' }}>
                    Day {meeting.day}, {meeting.time}
                  </div>
                </div>
                <span style={{ color: '#10b981', fontWeight: '500' }}>✓ Confirmed</span>
              </div>
            ))
          ) : (
            <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
              No confirmed meetings yet
            </div>
          )}
        </div>
        <button
          onClick={() => router.push("/allpeople")}
          style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', marginTop: '10px', width: '100%' }}
        >
          + Schedule New Meeting
        </button>
      </div>

      {/* Current Schedule */}
      <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Current Schedule</h2>
      <button className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors w-fit" onClick={()=>router.push("/addfreeperiod")}> Edit Schedule</button>
      <div style={{ overflowY: 'auto', overflowX: 'hidden', maxHeight: '700px' }}>
        {/* Week 1 */}
        <div style={{ marginBottom: '50px' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#600' }}>
            Week 1 (Days 1–5)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 110px repeat(5, 1fr)', gap: '12px', alignItems: 'center' }}>
            <div></div>
            <div></div>
            {['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontWeight: 'bold' }}>{day}</div>
            ))}
            {[0,1,2,3,4,5,6,7,8].map(rowIndex => renderRow(rowIndex, [0,1,2,3,4]))}
          </div>
        </div>

        {/* Week 2 */}
        <div>
          <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '15px', color: '#600' }}>
            Week 2 (Days 6–10)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '80px 110px repeat(5, 1fr)', gap: '12px', alignItems: 'center' }}>
            <div></div>
            <div></div>
            {['Day 6', 'Day 7', 'Day 8', 'Day 9', 'Day 10'].map(day => (
              <div key={day} style={{ textAlign: 'center', fontWeight: 'bold' }}>{day}</div>
            ))}
            {[0,1,2,3,4,5,6,7,8].map(rowIndex => renderRow(rowIndex, [5,6,7,8,9]))}
          </div>
        </div>
      </div>
    </div>
  );
}