"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { database } from '@/firebase';
import { ref, onValue } from 'firebase/database';

export default function AllPeoplePage() {
  const [open, setOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [people, setPeople] = useState<string[]>([]);

  const router = useRouter();

  // Load people from Firebase
  useEffect(() => {
    const namesRef = ref(database, 'names');
    const unsubscribe = onValue(namesRef, (snapshot) => {
      if (snapshot.exists()) {
        const namesData = snapshot.val();
        // Extract all names from the database
        const namesList = Object.values(namesData).map((entry: any) => entry.name);
        setPeople(namesList);
      }
    });

    return () => unsubscribe();
  }, []);

  const filteredPeople = people.filter((p) =>
    p.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-xl mx-auto mt-12 px-4">
      {/* Title */}
      <h1 className="text-3xl font-bold text-center mb-8">
        Search for Students and Teachers
      </h1>

      {/* Card */}
      <div className="bg-gray-100 rounded-2xl shadow-lg overflow-hidden">
        {/* Dropdown trigger */}
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between bg-gray-200 px-5 py-4 text-lg font-medium hover:bg-gray-300 transition-colors"
        >
          <span className="truncate">
            {selectedPerson ?? "Search"}
          </span>
          <span
            className={`transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
          >
            ▼
          </span>
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="bg-[#5F0817] px-4 py-4 space-y-4">
            {/* Search input */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search..."
              className="w-full rounded-lg px-4 py-2 text-lg bg-gray-200 text-black border border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />

            {/* Results */}
            <div className="space-y-2">
              {filteredPeople.length > 0 ? (
                filteredPeople.map((person, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setSelectedPerson(person);
                      setOpen(false);
                      setSearchTerm("");
                    }}
                    className="
                      w-full flex items-center justify-between
                      bg-white text-black text-lg font-medium
                      px-4 py-2 rounded-lg
                      hover:bg-gray-300 transition-colors
                      group
                    "
                  >
                    <span>{person}</span>
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      &gt;
                    </span>
                  </button>
                ))
              ) : (
                <div className="text-white text-sm px-2">
                  No results found
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="mt-8 flex flex-col items-center gap-3">
        <button
          onClick={() => {
            if (!selectedPerson) {
              alert('Please select a person first');
              return;
            }
            router.push(`/meetingtimes?person=${encodeURIComponent(selectedPerson)}`);
          }}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors w-fit"
        >
          Confirm
        </button>

        <button
          onClick={() => router.push("/profilepage")}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors w-fit"
        >
          Cancel
        </button>

        <button
          onClick={() => router.push("/profilepage")}
          className="text-sm text-white underline hover:text-gray-300 transition-colors"
        >
          Back
        </button>
      </div>
    </div>
  );
}