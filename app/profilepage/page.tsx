"use client";

import React, { useState, ChangeEvent, useEffect } from 'react';
import { useRouter } from "next/navigation";

interface Meeting {
  time: string;
  with: string;
}

export default function ProfilePage() {
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("Brighten Sun");
  const [bio, setBio] = useState("No Bio Yet");
  const [avatarBg, setAvatarBg] = useState<string>('#8B5CF6'); // default fallback
  const router = useRouter();

  // Initialize schedule only once
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
    "12:50 pm",
    "1:40 pm",
    "2:30 pm"
  ];

  const periodLabels = ['A', 'B', '', 'C', 'D', 'E', 'F', 'G', 'H']; // '' for Break

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
      // First visit: generate random color once
      const newColor = ['#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#6366F1', '#14B8A6'][Math.floor(Math.random() * 8)];
      setAvatarBg(newColor);
    }
  }, []);

  // Save to localStorage whenever relevant state changes
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

  const handleScheduleEdit = (row: number, col: number, value: string) => {
    if (row === 2) return; // Break row not editable
    setSchedule(prev => {
      const newSchedule = prev.map(r => [...r]);
      newSchedule[row][col] = value;
      return newSchedule;
    });
  };

  const avatarLetter = studentName.charAt(0).toUpperCase() || '?';

  const addMeeting = () => {
    setUpcomingMeetings([...upcomingMeetings, { time: "", with: "" }]);
  };

  const updateMeeting = (index: number, field: 'time' | 'with', value: string) => {
    const newMeetings = [...upcomingMeetings];
    newMeetings[index][field] = value;
    setUpcomingMeetings(newMeetings);
  };

  const removeMeeting = (index: number) => {
    setUpcomingMeetings(upcomingMeetings.filter((_, i) => i !== index));
  };

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
        {weekCols.map(col => (
          isBreakRow ? (
            <div
              key={col}
              style={{
                backgroundColor: '#555',
                color: 'white',
                padding: '14px',
                borderRadius: '12px',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: '600',
              }}
            >
              Break
            </div>
          ) : (
            <input
              key={col}
              type="text"
              value={schedule[rowIndex][col]}
              onChange={(e) => handleScheduleEdit(rowIndex, col, e.target.value)}
              placeholder="Class"
              style={{
                backgroundColor: '#800000',
                color: 'white',
                padding: '14px',
                borderRadius: '12px',
                border: 'none',
                textAlign: 'center',
                fontSize: '16px',
                fontWeight: '600',
              }}
            />
          )
        ))}
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
            onClick={() => router.push("/savedpeople")}
            style={{ padding: '8px 16px', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', marginTop: '10px' }}
          >
            + Add Meeting
          </button>
        </div>
      </div>

      {/* Current Schedule */}
      <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>Current Schedule</h2>

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
            {[0,1,2,3,4,5,6,7].map(rowIndex => renderRow(rowIndex, [0,1,2,3,4]))}
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
            {[0,1,2,3,4,5,6,7].map(rowIndex => renderRow(rowIndex, [5,6,7,8,9]))}
          </div>
        </div>
      </div>
    </div>
  );
}