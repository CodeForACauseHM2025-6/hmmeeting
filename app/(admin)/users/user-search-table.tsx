"use client";

import { useMemo, useState } from "react";

type UserWithRole = {
  id: string;
  fullName: string;
  email: string;
  resolvedRole: string;
};

type UserSearchTableProps = {
  users: UserWithRole[];
  roleOptions: readonly string[];
  upsertAction: (formData: FormData) => Promise<void>;
};

export default function UserSearchTable({
  users,
  roleOptions,
  upsertAction,
}: UserSearchTableProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return users;
    return users.filter(
      (user) =>
        user.fullName.toLowerCase().includes(trimmed) ||
        user.email.toLowerCase().includes(trimmed)
    );
  }, [searchQuery, users]);

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
            padding: "10px 12px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th
              style={{
                textAlign: "left",
                padding: "8px",
                borderBottom: "1px solid #ddd",
              }}
            >
              Name
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "8px",
                borderBottom: "1px solid #ddd",
              }}
            >
              Email
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "8px",
                borderBottom: "1px solid #ddd",
              }}
            >
              Role
            </th>
            <th
              style={{
                textAlign: "left",
                padding: "8px",
                borderBottom: "1px solid #ddd",
              }}
            >
              Update
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredUsers.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "16px 8px",
                  textAlign: "center",
                  color: "#666",
                }}
              >
                No users found matching "{searchQuery}"
              </td>
            </tr>
          ) : (
            filteredUsers.map((user) => (
              <tr key={user.id}>
                <td
                  style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}
                >
                  {user.fullName}
                </td>
                <td
                  style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}
                >
                  {user.email}
                </td>
                <td
                  style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}
                >
                  {user.resolvedRole}
                </td>
                <td
                  style={{ padding: "8px", borderBottom: "1px solid #f0f0f0" }}
                >
                  <form
                    action={upsertAction}
                    style={{
                      display: "flex",
                      gap: "8px",
                      alignItems: "center",
                    }}
                  >
                    <input type="hidden" name="email" value={user.email} />
                    <input
                      type="hidden"
                      name="fullName"
                      value={user.fullName}
                    />
                    <select
                      name="role"
                      defaultValue={user.resolvedRole}
                      style={{
                        padding: "6px 8px",
                        borderRadius: "6px",
                        border: "1px solid #ccc",
                      }}
                    >
                      {roleOptions.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      style={{
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "var(--primary)",
                        color: "#fff",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Update
                    </button>
                  </form>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
