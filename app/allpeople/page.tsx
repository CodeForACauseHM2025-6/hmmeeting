"use client";

import { useState } from "react";

export default function AllPeoplePage() {
  const [open, setOpen] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const people = ["Person 1", "Person 4", "Person 6", "Person 7"];

  const filteredPeople = people.filter((p) =>
    p.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full max-w-xl mx-auto mt-10">
      <h1 className="text-3xl font-bold mb-6 text-center">
        Search for Students and Teachers
      </h1>

      <div className="bg-gray-100 rounded-2xl shadow p-0 overflow-hidden">
        {/* Label */}

        {/* Search bar / dropdown toggle */}
        <div
          className="flex items-center justify-between bg-gray-200 px-4 py-3 cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          <span className="text-lg">
            {selectedPerson ? selectedPerson : "Search"}
          </span>
          <span
            className={`transition-transform ${open ? "rotate-180" : ""} inline-block`}
          >
            ▼
          </span>
        </div>

        {/* Dropdown */}
        {open && (
          <div className="bg-[#5F0817] p-4 space-y-3 rounded-b-xl">
            {/* Search input */}
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Type to search..."
              className="w-full px-3 py-2 rounded text-lg border border-gray-400 focus:outline-none focus:ring focus:ring-blue-300 bg-gray-200 text-black"
            />

            {/* Filtered list */}
            {filteredPeople.length > 0 ? (
              filteredPeople.map((person, index) => (
                <button
                  key={index}
                  className={`w-full flex justify-between items-center text-left text-lg font-medium px-4 py-2 rounded hover:bg-gray-400 group ${
                    selectedPerson === person
                      ? "bg-white text-black" // selected button stays white
                      : "bg-white text-black" // default button background white
                  }`}
                  onClick={() => {
                    setSelectedPerson(person);
                    setOpen(false);
                    setSearchTerm(""); // reset search

                    // Placeholder for navigation
                    // e.g., router.push(`/people/${personId}`)
                  }}
                >
                  <span>{person}</span>
                  {/* Show ">" only on hover */}
                  <span className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    &gt;
                  </span>
                </button>
              ))
            ) : (
              <div className="text-white px-4 py-2">No results found</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
