"use client";

import { useEffect, useState } from "react";
import { inputClass } from "@/components/ui";

export type RoomOption = { name: string; capacity: number | null; floor: string; available: boolean };

export function RoomSelect({
  name = "meetingRoom",
  defaultValue = "",
  date,
  time,
  disabled,
  required,
  rooms: initialRooms = [],
}: {
  name?: string;
  defaultValue?: string;
  date: string;
  time: string;
  disabled?: boolean;
  required?: boolean;
  rooms?: RoomOption[];
}) {
  const [value, setValue] = useState(defaultValue);
  const [rooms, setRooms] = useState<RoomOption[]>(initialRooms);
  const [loading, setLoading] = useState(!initialRooms.length);

  useEffect(() => {
    if (!date) return;
    const query = new URLSearchParams({ date, time: time || "09:30" });
    fetch(`/api/rooms?${query}`, { credentials: "same-origin" })
      .then((res) => res.json())
      .then((data: { rooms?: RoomOption[]; source?: string }) => {
        if (!data.rooms?.length) return;
        if (data.source === "fallback" && initialRooms.length) return;
        setRooms(data.rooms);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [date, time, initialRooms.length]);

  return (
    <select name={name} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} disabled={disabled} required={required}>
      <option value="">{loading && !rooms.length ? "Loading rooms…" : "Select a room"}</option>
      {rooms.map((room) => (
        <option key={room.name} value={room.name}>
          {room.name}
          {room.capacity ? ` · ${room.capacity}` : ""}
          {room.floor ? ` · ${room.floor}` : ""}
          {room.available ? " · Free" : " · Busy"}
        </option>
      ))}
    </select>
  );
}
