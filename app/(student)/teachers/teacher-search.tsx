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
        <div style={{
          padding: "12px 16px",
          background: "#f0fdf4",
          border: "1px solid #bbf7d0",
          borderRadius: "10px",
          color: "var(--success)",
          marginBottom: "16px",
          fontWeight: 600,
          fontSize: "14px",
        }}>
          Meeting request sent successfully.
        </div>
      )}
      <div style={{
        borderRadius: "14px",
        padding: "28px",
        background: "var(--surface)",
        boxShadow: "0 1px 3px rgba(91,13,31,0.04), 0 4px 20px rgba(91,13,31,0.06)",
        border: "1px solid var(--border-light)",
      }}>
        <label style={{
          display: "block",
          marginBottom: "8px",
          fontWeight: 600,
          fontSize: "12px",
          letterSpacing: "0.03em",
          color: "var(--muted)",
        }}>
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
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            fontSize: "14px",
          }}
        />

        {query.trim().length > 0 && (
          <div style={{ marginTop: "12px" }}>
            {suggestions.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: "14px" }}>No matches.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {suggestions.map((teacher) => (
                  <button
                    key={teacher.id}
                    type="button"
                    className="card-hover"
                    onClick={() => handleSelect(teacher)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      padding: "12px 16px",
                      borderRadius: "10px",
                      border: selected?.id === teacher.id ? "1px solid var(--primary)" : "1px solid var(--border-light)",
                      backgroundColor: selected?.id === teacher.id ? "var(--primary-soft)" : "var(--surface)",
                      cursor: "pointer",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: "14px" }}>{teacher.fullName}</span>
                    <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "2px" }}>
                      {teacher.email}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          className={selected ? "btn-fill" : ""}
          onClick={() => {
            if (!selected) return;
            router.push(`/teachers/${selected.id}?name=${encodeURIComponent(selected.fullName)}`);
          }}
          disabled={!selected}
          style={{
            marginTop: "16px",
            padding: "12px 20px",
            backgroundColor: selected ? "var(--primary)" : "var(--border)",
            color: "white",
            borderRadius: "8px",
            border: "none",
            cursor: selected ? "pointer" : "not-allowed",
            fontWeight: 600,
            fontSize: "14px",
          }}
        >
          Show availability
        </button>
      </div>
    </div>
  );
}
