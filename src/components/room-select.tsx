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
  allowNone = false,
  keepBooked = "",
  rooms: initialRooms = [],
}: {
  name?: string;
  defaultValue?: string;
  date: string;
  time: string;
  disabled?: boolean;
  required?: boolean;
  allowNone?: boolean;
  keepBooked?: string;
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

  useEffect(() => {
    if (value === "N/A") return;
    const picked = rooms.find((room) => room.name === value);
    if (picked && !picked.available && picked.name !== keepBooked) setValue(allowNone ? "N/A" : "");
  }, [rooms, value, keepBooked, allowNone]);

  return (
    <select name={name} value={value} onChange={(event) => setValue(event.target.value)} className={inputClass} disabled={disabled} required={required}>
      <option value="">{loading && !rooms.length ? "Loading rooms…" : "Select a room"}</option>
      {allowNone ? <option value="N/A">N/A</option> : null}
      {value && !rooms.some((room) => room.name === value) ? <option value={value}>{value}</option> : null}
      {rooms.map((room) => {
        const open = room.available || room.name === keepBooked;
        return (
          <option key={room.name} value={open ? room.name : ""} disabled={!open}>
            {open ? room.name : `${room.name} · Already Booked`}
          </option>
        );
      })}
    </select>
  );
}
