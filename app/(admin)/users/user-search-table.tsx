"use client";

import { useMemo, useState, useRef, useEffect } from "react";

const PERIODS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const DAYS = Array.from({ length: 10 }, (_, i) => i + 1);

type UserWithRole = {
  id: string;
  fullName: string;
  email: string;
  resolvedRole: string;
};

type ScheduleSlot = { day: number; period: string; type: string };
type ScheduleData = {
  fullName: string;
  email: string;
  role: string;
  schedule: ScheduleSlot[];
};

type UserSearchTableProps = {
  users: UserWithRole[];
  roleOptions: readonly string[];
  upsertAction: (formData: FormData) => Promise<void>;
  removeAction: (formData: FormData) => Promise<void>;
  clearAllAction: () => Promise<void>;
};

export default function UserSearchTable({
  users,
  roleOptions,
  upsertAction,
  removeAction,
  clearAllAction,
}: UserSearchTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [roleSubMenuId, setRoleSubMenuId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<UserWithRole | null>(null);
  const [clearStep, setClearStep] = useState<0 | 1 | 2>(0);
  const [clearInput, setClearInput] = useState("");
  const [clearing, setClearing] = useState(false);
  const [scheduleUser, setScheduleUser] = useState<UserWithRole | null>(null);
  const [scheduleData, setScheduleData] = useState<ScheduleData | null>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredUsers = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(trimmed) ||
        user.email.toLowerCase().includes(trimmed)
    );
  }, [searchQuery, users]);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
        setRoleSubMenuId(null);
      }
    }
    if (openMenuId) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [openMenuId]);

  const handleRoleChange = async (user: UserWithRole, newRole: string) => {
    const formData = new FormData();
    formData.set("email", user.email);
    formData.set("fullName", user.fullName);
    formData.set("role", newRole);
    await upsertAction(formData);
    setOpenMenuId(null);
    setRoleSubMenuId(null);
  };

  const handleRemoveConfirm = async () => {
    if (!confirmRemove) return;
    const formData = new FormData();
    formData.set("email", confirmRemove.email);
    await removeAction(formData);
    setConfirmRemove(null);
  };

  const handleViewSchedule = async (user: UserWithRole) => {
    setOpenMenuId(null);
    setScheduleUser(user);
    setScheduleData(null);
    setScheduleLoading(true);
    try {
      const res = await fetch(`/api/admin/user-schedule?userId=${user.id}`);
      if (res.ok) {
        const data = await res.json();
        setScheduleData(data);
      }
    } catch {
      // ignore
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    await clearAllAction();
    setClearing(false);
    setClearStep(0);
    setClearInput("");
  };

  return (
    <div>
      <div style={{ marginBottom: "16px" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          style={{
            width: "100%",
            maxWidth: "400px",
            padding: '12px 14px',
            borderRadius: '8px',
            border: '2px solid var(--border)',
            fontSize: '15px',
          }}
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left', padding: '14px', background: 'var(--primary)', color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.06em' }}>
              Name
            </th>
            <th style={{ textAlign: 'left', padding: '14px', background: 'var(--primary)', color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.06em' }}>
              Email
            </th>
            <th style={{ textAlign: 'left', padding: '14px', background: 'var(--primary)', color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.06em' }}>
              Role
            </th>
            <th style={{ textAlign: 'center', padding: '14px', background: 'var(--primary)', color: '#fff', fontWeight: 700, textTransform: 'uppercase', fontSize: '12px', letterSpacing: '0.06em', width: '60px' }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                style={{ padding: "16px 8px", textAlign: "center", color: "#666" }}
              >
                No users found matching &quot;{searchQuery}&quot;
              </td>
            </tr>
          ) : (
            filteredUsers.map((user) => (
              <tr key={user.id}>
                <td style={{ padding: '14px', borderBottom: '2px solid #f0ece6' }}>
                  {user.fullName}
                </td>
                <td style={{ padding: '14px', borderBottom: '2px solid #f0ece6' }}>
                  {user.email}
                </td>
                <td style={{ padding: '14px', borderBottom: '2px solid #f0ece6' }}>
                  {user.resolvedRole}
                </td>
                <td
                  style={{
                    padding: '14px',
                    borderBottom: '2px solid #f0ece6',
                    textAlign: 'center',
                    position: 'relative',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setOpenMenuId(openMenuId === user.id ? null : user.id);
                      setRoleSubMenuId(null);
                    }}
                    style={{
                      background: 'none',
                      border: '2px solid var(--border)',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '16px',
                    }}
                    title="Actions"
                  >
                    ⚙
                  </button>

                  {openMenuId === user.id && (
                    <div
                      ref={menuRef}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: '100%',
                        background: '#fff',
                        border: '2px solid var(--primary)',
                        borderRadius: '10px',
                        boxShadow: '0 8px 24px rgba(91,13,31,0.12)',
                        zIndex: 100,
                        minWidth: '180px',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Change Role */}
                      <button
                        type="button"
                        onClick={() =>
                          setRoleSubMenuId(roleSubMenuId === user.id ? null : user.id)
                        }
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          border: 'none',
                          background: roleSubMenuId === user.id ? '#f5f5f5' : '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                        }}
                      >
                        Change Role ▸
                      </button>

                      {roleSubMenuId === user.id && (
                        <div style={{ background: "#fafafa", borderTop: "1px solid #eee" }}>
                          {roleOptions.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => handleRoleChange(user, role)}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 14px 8px 28px",
                                border: "none",
                                background:
                                  user.resolvedRole === role ? "#e8e0e3" : "transparent",
                                cursor: "pointer",
                                fontSize: "13px",
                                fontWeight: user.resolvedRole === role ? 600 : 400,
                              }}
                            >
                              {role}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* View Schedule */}
                      <button
                        type="button"
                        onClick={() => handleViewSchedule(user)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          border: 'none',
                          borderTop: '1px solid #eee',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                        }}
                      >
                        View Schedule
                      </button>

                      {/* Remove User */}
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          setConfirmRemove(user);
                        }}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 16px',
                          border: 'none',
                          borderTop: '1px solid #eee',
                          background: '#fff',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: 600,
                          color: '#d32f2f',
                        }}
                      >
                        Remove User
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Remove user confirmation modal */}
      {confirmRemove && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setConfirmRemove(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '32px',
              maxWidth: '400px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '12px', color: '#d32f2f', fontFamily: 'var(--font-lora, Georgia, serif)' }}>Remove User</h3>
            <p style={{ marginBottom: "20px" }}>
              Are you sure you want to remove <strong>{confirmRemove.fullName}</strong> ({confirmRemove.email})?
              This will delete their account and all associated data.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setConfirmRemove(null)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemoveConfirm}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#d32f2f',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Schedule popup */}
      {scheduleUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setScheduleUser(null)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '32px',
              maxWidth: '700px',
              width: '95%',
              maxHeight: '85vh',
              overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '4px', color: 'var(--primary)', fontFamily: 'var(--font-lora, Georgia, serif)' }}>
              {scheduleUser.fullName}&apos;s Schedule
            </h3>
            <p style={{ color: "#666", fontSize: "13px", marginBottom: "16px" }}>
              {scheduleUser.email} &middot; {scheduleUser.resolvedRole}
            </p>

            {scheduleLoading ? (
              <p style={{ textAlign: "center", color: "#999", padding: "20px 0" }}>Loading...</p>
            ) : scheduleData ? (
              <>
                {/* Color legend */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '3px',
                        border: '2px solid #ccc',
                        background: '#fff',
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#555" }}>Busy</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        width: '20px',
                        height: '20px',
                        borderRadius: '3px',
                        border: '2px solid #5b0d1f',
                        background: '#5b0d1f',
                      }}
                    />
                    <span style={{ fontSize: "12px", color: "#555" }}>Free</span>
                  </div>
                  {scheduleData.role === "TEACHER" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '3px',
                          border: '2px solid #6a1b9a',
                          background: '#6a1b9a',
                        }}
                      />
                      <span style={{ fontSize: "12px", color: "#555" }}>Office Hours</span>
                    </div>
                  )}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #ddd" }}>
                          Period
                        </th>
                        {DAYS.map((day) => (
                          <th
                            key={day}
                            style={{
                              padding: "6px 4px",
                              textAlign: "center",
                              borderBottom: "1px solid #ddd",
                              color: "var(--primary)",
                              fontSize: "12px",
                            }}
                          >
                            Day {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {PERIODS.map((period) => (
                        <tr key={period}>
                          <td style={{ padding: "6px 8px", fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>
                            {period}
                          </td>
                          {DAYS.map((day) => {
                            const slot = scheduleData.schedule.find(
                              (s) => s.day === day && s.period === period
                            );
                            let bg = "#fff";
                            let color = "#aaa";
                            let label = "";
                            if (slot) {
                              if (slot.type === "OFFICE_HOURS") {
                                bg = "#6a1b9a";
                                color = "#fff";
                                label = "OH";
                              } else {
                                bg = "#5b0d1f";
                                color = "#fff";
                                label = "Free";
                              }
                            }
                            return (
                              <td
                                key={`${day}-${period}`}
                                style={{
                                  padding: "4px 2px",
                                  textAlign: "center",
                                  borderBottom: "1px solid #f0f0f0",
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: bg,
                                    color,
                                    borderRadius: "4px",
                                    padding: "6px 0",
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    border: slot ? "none" : "1px solid #eee",
                                    minWidth: "36px",
                                  }}
                                >
                                  {label}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {scheduleData.schedule.length === 0 && (
                  <p style={{ textAlign: "center", color: "#999", marginTop: "12px" }}>
                    No availability set.
                  </p>
                )}
              </>
            ) : (
              <p style={{ textAlign: "center", color: "#d32f2f", padding: "20px 0" }}>
                Failed to load schedule.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                type="button"
                onClick={() => setScheduleUser(null)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Schedules section */}
      <div
        style={{
          marginTop: "32px",
          borderTop: "1px solid #eee",
          paddingTop: "24px",
        }}
      >
        <h3 style={{ fontSize: '16px', color: '#d32f2f', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
          Danger Zone
        </h3>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "12px" }}>
          Clear all schedules will set every period to busy and cancel all active meetings.
        </p>
        <button
          type="button"
          onClick={() => setClearStep(1)}
          style={{
            padding: '10px 20px',
            borderRadius: '6px',
            border: '2px solid var(--danger)',
            background: '#fff',
            color: 'var(--danger)',
            fontWeight: 700,
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Clear All Schedules
        </button>
      </div>

      {/* Clear step 1: first confirmation */}
      {clearStep === 1 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => { setClearStep(0); setClearInput(""); }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '12px', color: '#d32f2f', fontFamily: 'var(--font-lora, Georgia, serif)' }}>Are you sure?</h3>
            <p style={{ marginBottom: "20px" }}>
              This will set all periods to busy and cancel all active meetings. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setClearStep(0); setClearInput(""); }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setClearStep(2)}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#d32f2f',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                }}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear step 2: text confirmation */}
      {clearStep === 2 && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => { setClearStep(0); setClearInput(""); }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '14px',
              padding: '32px',
              maxWidth: '420px',
              width: '90%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: '12px', color: '#d32f2f', fontFamily: 'var(--font-lora, Georgia, serif)' }}>Type &quot;clear&quot; to confirm</h3>
            <p style={{ marginBottom: "12px", fontSize: "14px", color: "#666" }}>
              This will permanently clear all schedules and cancel all meetings.
            </p>
            <input
              type="text"
              value={clearInput}
              onChange={(e) => setClearInput(e.target.value)}
              placeholder='Type "clear"'
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '2px solid var(--border)',
                marginBottom: '16px',
                fontSize: '15px',
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => { setClearStep(0); setClearInput(""); }}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: '1px solid #ccc',
                  background: '#fff',
                  cursor: 'pointer',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearInput.trim().toLowerCase() !== "clear" || clearing}
                onClick={handleClearAll}
                style={{
                  padding: '12px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  background:
                    clearInput.trim().toLowerCase() === "clear" ? "#d32f2f" : "#ccc",
                  color: '#fff',
                  fontWeight: 700,
                  cursor:
                    clearInput.trim().toLowerCase() === "clear" ? "pointer" : "not-allowed",
                  textTransform: 'uppercase',
                }}
              >
                {clearing ? "Clearing..." : "Clear All Schedules"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
