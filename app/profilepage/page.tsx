"use client";

import React, { useState, ChangeEvent, useEffect } from 'react';
import { useRouter } from "next/navigation";
import { database } from '@/firebase';
import { ref, onValue } from 'firebase/database';

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
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("Brighten Sun");
  const [bio, setBio] = useState("No Bio Yet");
  const [avatarBg, setAvatarBg] = useState<string>('#8B5CF6');
  const [frees, setFrees] = useState<FreePeriod[]>([]);
  const router = useRouter();

  const createEmptySchedule = () => {
    return Array(8).fill(null).map(() => Array(10).fill(''));
  };

  const [schedule, setSchedule] = useState<string[][]>(() => createEmptySchedule());

  const [upcomingMeetings, setUpcomingMeetings] = useState<Meeting[]>([
    { time: "Tomorrow 3:00 pm", with: "Mr. Johnson - Math Help" },
    { time: "Friday 10:00 am", with: "College Advisor" },
  ]);

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
    const freesRef = ref(database, 'freeTimes/user1');
    const unsubscribeFrees = onValue(freesRef, (snapshot) => {
      if (snapshot.exists()) {
        setFrees(snapshot.val().periods || []);
      }
    });

    const nameRef = ref(database, 'names/user1');
    const unsubscribeName = onValue(nameRef, (snapshot) => {
      if (snapshot.exists()) {
        const firebaseName = snapshot.val().name;
        if (firebaseName) {
          setStudentName(firebaseName);
        }
      }
    });

    return () => {
      unsubscribeFrees();
      unsubscribeName();
    };
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('profileData');
    if (saved) {
      const data = JSON.parse(saved);
      setStudentName(data.studentName ?? "Brighten Sun");
      setBio(data.bio ?? "No Bio Yet");
      setProfileImage(data.profileImage ?? null);
      setSchedule(data.schedule ?? createEmptySchedule());
      setUpcomingMeetings(data.upcomingMeetings ?? []);
      setAvatarBg(data.avatarBg ?? '#8B5CF6');
    } else {
      const newColor = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6'][Math.floor(Math.random() * 8)];
      setAvatarBg(newColor);
    }
  }, []);

  useEffect(() => {
    const data = {
      studentName,
      bio,
      profileImage,
      schedule,
      upcomingMeetings,
      avatarBg,
    };
    localStorage.setItem('profileData', JSON.stringify(data));
  }, [studentName, bio, profileImage, schedule, upcomingMeetings, avatarBg]);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setProfileImage(imageUrl);
    }
  };

  const avatarLetter = studentName.charAt(0).toUpperCase() || '?';

  const updateMeeting = (index: number, field: 'time' | 'with', value: string) => {
    const newMeetings = [...upcomingMeetings];
    newMeetings[index][field] = value;
    setUpcomingMeetings(newMeetings);
  };

  const removeMeeting = (index: number) => {
    setUpcomingMeetings(upcomingMeetings.filter((_, i) => i !== index));
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

      {/* Upcoming Meetings - Editable */}
      <div style={{ marginBottom: '40px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: 'bold', marginBottom: '12px' }}>
          Upcoming Meetings
        </h3>
        <div style={{ backgroundColor: '#f9f9f9', padding: '16px', borderRadius: '8px' }}>
          {upcomingMeetings.map((meeting, i) => (
            <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={meeting.time}
                onChange={(e) => updateMeeting(i, 'time', e.target.value)}
                placeholder="Time (e.g. Tomorrow 3pm)"
                style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <input
                type="text"
                value={meeting.with}
                onChange={(e) => updateMeeting(i, 'with', e.target.value)}
                placeholder="With whom / purpose"
                style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
              />
              <button
                onClick={() => removeMeeting(i)}
                style={{ padding: '8px 12px', background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px' }}
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => router.push("/allpeople")}
            style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', marginTop: '10px' }}
          >
            + Add Meeting
          </button>
        </div>
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