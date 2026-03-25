"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type TeacherOption = {
  id: string;
  fullName: string;
  email: string;
};

type TeacherSearchProps = {
  teachers: TeacherOption[];
  isAdmin?: boolean;
};

export default function TeacherSearch({ teachers, isAdmin }: TeacherSearchProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TeacherOption | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const bookingSuccess = searchParams.get("booking") === "success";

  const suggestions = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];
    return teachers.filter(
      (teacher) =>
        teacher.fullName.toLowerCase().includes(trimmed) ||
        teacher.email.toLowerCase().includes(trimmed)
    );
  }, [query, teachers]);

  const handleSelect = (teacher: TeacherOption) => {
    setSelected(teacher);
    setQuery(teacher.fullName);
  };

  return (
    <div>
      {bookingSuccess && (
        <div
          style={{
            padding: "14px 18px",
            background: "#ecfdf5",
            border: "2px solid var(--success)",
            borderRadius: "10px",
            color: "var(--success)",
            marginBottom: "16px",
            fontWeight: 700,
          }}
        >
          Meeting request sent successfully!
        </div>
      )}
      <div
        style={{
          border: "none",
          borderLeft: "4px solid var(--primary)",
          borderRadius: "10px",
          padding: "28px",
          background: "#fff",
          boxShadow: "0 4px 20px rgba(91,13,31,0.08)",
        }}
      >
      <label style={{ display: "block", marginBottom: "8px", fontWeight: 700, fontSize: "13px", textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--muted)" }}>
        {isAdmin ? "Search for a user" : "Search for a teacher"}
      </label>
      <input
        type="text"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setSelected(null);
        }}
        placeholder="Start typing a name or email..."
        style={{
          width: "100%",
          padding: "14px 16px",
          borderRadius: "8px",
          border: "2px solid var(--border)",
          fontSize: "15px",
        }}
      />

      {query.trim().length > 0 && (
        <div style={{ marginTop: "12px" }}>
          {suggestions.length === 0 ? (
            <p style={{ color: "#666" }}>No matches.</p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {suggestions.map((teacher) => (
                <li key={teacher.id} style={{ marginBottom: "8px" }}>
                  <button
                    type="button"
                    onClick={() => handleSelect(teacher)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "14px 16px",
                      borderRadius: "10px",
                      border: "2px solid #f0ece6",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 700, fontSize: "15px" }}>{teacher.fullName}</span>
                    <div style={{ fontSize: "12px", color: "#666", marginTop: "4px" }}>
                      {teacher.email}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => {
          if (!selected) return;
          router.push(`/teachers/${selected.id}?name=${encodeURIComponent(selected.fullName)}`);
        }}
        disabled={!selected}
        style={{
          marginTop: "16px",
          padding: "14px 24px",
          backgroundColor: selected ? "var(--primary)" : "#d4cfc8",
          color: "white",
          borderRadius: "10px",
          border: "none",
          cursor: selected ? "pointer" : "not-allowed",
          fontWeight: 700,
          textTransform: "uppercase" as const,
          letterSpacing: "0.05em",
          fontSize: "15px",
        }}
      >
        Show availability
      </button>
      </div>
    </div>
  );
}
