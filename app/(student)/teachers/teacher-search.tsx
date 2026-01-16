"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type TeacherOption = {
  id: string;
  fullName: string;
  email: string;
};

type TeacherSearchProps = {
  teachers: TeacherOption[];
};

export default function TeacherSearch({ teachers }: TeacherSearchProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<TeacherOption | null>(null);
  const router = useRouter();

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
    <div
      style={{
        border: "1px solid var(--primary)",
        borderRadius: "12px",
        padding: "20px",
        background: "#fff",
        boxShadow: "0 8px 16px rgba(0,0,0,0.04)",
      }}
    >
      <label style={{ display: "block", marginBottom: "8px", fontWeight: 600 }}>
        Search for a teacher
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
          padding: "10px 12px",
          borderRadius: "8px",
          border: "1px solid #ccc",
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
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #e0e0e0",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    {teacher.fullName}
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
          padding: "10px 16px",
          backgroundColor: selected ? "var(--primary)" : "#b8b8b8",
          color: "white",
          borderRadius: "8px",
          border: "none",
          cursor: selected ? "pointer" : "not-allowed",
          fontWeight: 600,
        }}
      >
        Show availability
      </button>
    </div>
  );
}
