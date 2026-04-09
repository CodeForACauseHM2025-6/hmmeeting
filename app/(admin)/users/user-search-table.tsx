"use client";

import { useMemo, useState, useRef, useEffect } from "react";

const PERIODS = ["A", "B", "BREAK", "C", "D", "E", "F", "G", "H"] as const;
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
            padding: "10px 14px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            fontSize: "14px",
          }}
        />
      </div>

      <div style={{
        borderRadius: "12px",
        overflow: "hidden",
        border: "1px solid var(--border-light)",
        boxShadow: "0 1px 3px rgba(91,13,31,0.04)",
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "12px 16px", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: "12px", letterSpacing: "0.04em" }}>
                Name
              </th>
              <th style={{ textAlign: "left", padding: "12px 16px", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: "12px", letterSpacing: "0.04em" }}>
                Email
              </th>
              <th style={{ textAlign: "left", padding: "12px 16px", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: "12px", letterSpacing: "0.04em" }}>
                Role
              </th>
              <th style={{ textAlign: "center", padding: "12px 16px", background: "var(--primary)", color: "#fff", fontWeight: 600, fontSize: "12px", letterSpacing: "0.04em", width: "60px" }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td
                  colSpan={4}
                  style={{ padding: "24px 16px", textAlign: "center", color: "var(--muted)", fontSize: "14px" }}
                >
                  No users found matching &quot;{searchQuery}&quot;
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", fontSize: "14px", fontWeight: 500 }}>
                    {user.fullName}
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", fontSize: "14px", color: "var(--muted)" }}>
                    {user.email}
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-light)", fontSize: "14px" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "2px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      background: "var(--primary-soft)",
                      color: "var(--primary)",
                    }}>
                      {user.resolvedRole}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-light)",
                      textAlign: "center",
                      position: "relative",
                    }}
                  >
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setOpenMenuId(openMenuId === user.id ? null : user.id);
                        setRoleSubMenuId(null);
                      }}
                      style={{
                        background: "none",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        padding: "6px 10px",
                        cursor: "pointer",
                        fontSize: "14px",
                      }}
                      title="Actions"
                    >
                      &#x2699;
                    </button>

                    {openMenuId === user.id && (
                      <div
                        ref={menuRef}
                        className="dropdown-enter"
                        style={{
                          position: "absolute",
                          right: 0,
                          top: "100%",
                          background: "var(--surface)",
                          border: "1px solid var(--border)",
                          borderRadius: "10px",
                          boxShadow: "0 8px 24px rgba(91,13,31,0.1)",
                          zIndex: 100,
                          minWidth: "180px",
                          overflow: "hidden",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setRoleSubMenuId(roleSubMenuId === user.id ? null : user.id)
                          }
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 16px",
                            border: "none",
                            background: roleSubMenuId === user.id ? "var(--surface-warm)" : "var(--surface)",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 500,
                          }}
                        >
                          Change role &#x25B8;
                        </button>

                        {roleSubMenuId === user.id && (
                          <div style={{ background: "var(--surface-warm)", borderTop: "1px solid var(--border-light)" }}>
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
                                    user.resolvedRole === role ? "var(--primary-soft)" : "transparent",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  fontWeight: user.resolvedRole === role ? 600 : 400,
                                }}
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleViewSchedule(user)}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 16px",
                            border: "none",
                            borderTop: "1px solid var(--border-light)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 500,
                          }}
                        >
                          View schedule
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setOpenMenuId(null);
                            setConfirmRemove(user);
                          }}
                          style={{
                            display: "block",
                            width: "100%",
                            textAlign: "left",
                            padding: "10px 16px",
                            border: "none",
                            borderTop: "1px solid var(--border-light)",
                            background: "var(--surface)",
                            cursor: "pointer",
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--danger)",
                          }}
                        >
                          Remove user
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Remove user confirmation modal */}
      {confirmRemove && (
        <div
          className="modal-overlay"
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
            className="modal-panel"
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px", color: "var(--danger)", fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "20px" }}>Remove user</h3>
            <p style={{ marginBottom: "20px", fontSize: "14px", color: "var(--muted)" }}>
              Are you sure you want to remove <strong style={{ color: "var(--foreground)" }}>{confirmRemove.fullName}</strong> ({confirmRemove.email})?
              This will delete their account and all associated data.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setConfirmRemove(null)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--foreground)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill"
                onClick={handleRemoveConfirm}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
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
          className="modal-overlay"
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
            className="modal-panel"
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "700px",
              width: "95%",
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "4px", color: "var(--primary)", fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "20px" }}>
              {scheduleUser.fullName}&apos;s schedule
            </h3>
            <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "16px" }}>
              {scheduleUser.email} &middot; {scheduleUser.resolvedRole}
            </p>

            {scheduleLoading ? (
              <div style={{ padding: "24px 0" }}>
                <div className="skeleton" style={{ height: "200px", width: "100%" }} />
              </div>
            ) : scheduleData ? (
              <>
                {/* Color legend */}
                <div style={{ display: "flex", gap: "16px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "3px", border: "1px solid var(--border)", background: "var(--surface)" }} />
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Busy</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ width: "16px", height: "16px", borderRadius: "3px", background: "var(--primary)" }} />
                    <span style={{ fontSize: "12px", color: "var(--muted)" }}>Free</span>
                  </div>
                  {scheduleData.role === "TEACHER" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ width: "16px", height: "16px", borderRadius: "3px", background: "var(--slot-oh)" }} />
                      <span style={{ fontSize: "12px", color: "var(--muted)" }}>Office hours</span>
                    </div>
                  )}
                </div>

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: "8px 8px", borderBottom: "1px solid var(--border-light)", color: "var(--muted)", fontSize: "11px", fontWeight: 600, letterSpacing: "0.03em" }}>
                          Period
                        </th>
                        {DAYS.map((day) => (
                          <th
                            key={day}
                            style={{
                              padding: "8px 4px",
                              textAlign: "center",
                              borderBottom: "1px solid var(--border-light)",
                              color: "var(--primary)",
                              fontSize: "11px",
                              fontWeight: 600,
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
                          <td style={{ padding: "6px 8px", fontWeight: 600, borderBottom: "1px solid var(--border-light)", fontSize: "12px" }}>
                            {period === "BREAK" ? "Break" : period}
                          </td>
                          {DAYS.map((day) => {
                            const slot = scheduleData.schedule.find(
                              (s) => s.day === day && s.period === period
                            );
                            let bg = "var(--surface)";
                            let color = "transparent";
                            let label = "";
                            if (slot) {
                              if (slot.type === "OFFICE_HOURS") {
                                bg = "var(--slot-oh)";
                                color = "#fff";
                                label = "OH";
                              } else {
                                bg = "var(--primary)";
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
                                  borderBottom: "1px solid var(--border-light)",
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: bg,
                                    color,
                                    borderRadius: "4px",
                                    padding: "5px 0",
                                    fontSize: "10px",
                                    fontWeight: 600,
                                    border: slot ? "none" : "1px solid var(--border-light)",
                                    minWidth: "32px",
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
                  <p style={{ textAlign: "center", color: "var(--muted)", marginTop: "12px", fontSize: "14px" }}>
                    No availability set.
                  </p>
                )}
              </>
            ) : (
              <p style={{ textAlign: "center", color: "var(--danger)", padding: "20px 0", fontSize: "14px" }}>
                Failed to load schedule.
              </p>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => setScheduleUser(null)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--foreground)",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Schedules section */}
      <div style={{
        marginTop: "32px",
        borderTop: "1px solid var(--border-light)",
        paddingTop: "24px",
      }}>
        <h3 style={{ fontSize: "14px", color: "var(--danger)", marginBottom: "8px", fontWeight: 600 }}>
          Danger zone
        </h3>
        <p style={{ color: "var(--muted)", fontSize: "13px", marginBottom: "12px" }}>
          Clear all schedules will set every period to busy and cancel all active meetings.
        </p>
        <button
          type="button"
          className="btn-danger-outline"
          onClick={() => setClearStep(1)}
          style={{
            padding: "8px 16px",
            borderRadius: "6px",
            border: "1px solid var(--danger)",
            background: "var(--surface)",
            color: "var(--danger)",
            fontWeight: 600,
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          Clear all schedules
        </button>
      </div>

      {/* Clear step 1: first confirmation */}
      {clearStep === 1 && (
        <div
          className="modal-overlay"
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
            className="modal-panel"
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px", color: "var(--danger)", fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "20px" }}>Are you sure?</h3>
            <p style={{ marginBottom: "20px", fontSize: "14px", color: "var(--muted)" }}>
              This will set all periods to busy and cancel all active meetings. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => { setClearStep(0); setClearInput(""); }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--foreground)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill"
                onClick={() => setClearStep(2)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--danger)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
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
          className="modal-overlay"
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
            className="modal-panel"
            style={{
              background: "var(--surface)",
              borderRadius: "16px",
              padding: "32px",
              maxWidth: "420px",
              width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginBottom: "12px", color: "var(--danger)", fontFamily: "var(--font-lora, Georgia, serif)", fontSize: "20px" }}>
              Type &quot;clear&quot; to confirm
            </h3>
            <p style={{ marginBottom: "12px", fontSize: "13px", color: "var(--muted)" }}>
              This will permanently clear all schedules and cancel all meetings.
            </p>
            <input
              type="text"
              value={clearInput}
              onChange={(e) => setClearInput(e.target.value)}
              placeholder='Type "clear"'
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border)",
                marginBottom: "16px",
                fontSize: "14px",
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn-outline"
                onClick={() => { setClearStep(0); setClearInput(""); }}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--foreground)",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill"
                disabled={clearInput.trim().toLowerCase() !== "clear" || clearing}
                onClick={handleClearAll}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background:
                    clearInput.trim().toLowerCase() === "clear" ? "var(--danger)" : "var(--border)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor:
                    clearInput.trim().toLowerCase() === "clear" ? "pointer" : "not-allowed",
                }}
              >
                {clearing ? "Clearing..." : "Clear all schedules"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
