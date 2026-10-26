"use client";

import { useEffect, useState } from "react";
import { displayImageSrc } from "@/lib/display-label";

function dubaiClock(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function DisplayKiosk({
  room,
  sizeInches,
  imagePath,
}: {
  room: string;
  sizeInches: number;
  message?: string;
  imagePath: string | null;
}) {
  const [clock, setClock] = useState("");
  const [idle, setIdle] = useState(false);
  const src = imagePath ? displayImageSrc(imagePath) : "";

  useEffect(() => {
    const tick = () => setClock(dubaiClock(new Date()));
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const goFull = () => {
      if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => undefined);
    };
    goFull();
    const wake = () => {
      setIdle(false);
      goFull();
    };
    let hide = window.setTimeout(() => setIdle(true), 2500);
    const onMove = () => {
      setIdle(false);
      window.clearTimeout(hide);
      hide = window.setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("click", wake);
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("click", wake);
      window.removeEventListener("mousemove", onMove);
      window.clearTimeout(hide);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 h-[100dvh] w-[100dvw] max-w-[100vw] overflow-hidden bg-white ${idle ? "cursor-none" : ""}`}
      style={{ WebkitTextSizeAdjust: "100%" }}
    >
      {src ? (
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-contain" />
      ) : (
        <div className="absolute inset-0 bg-[#f7f4f4]" />
      )}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-[max(16px,env(safe-area-inset-top))] text-[clamp(11px,1.6vw,14px)] tracking-[0.14em] text-black/35">
        <span>{room.toUpperCase()}</span>
        <span>
          {clock} · {sizeInches}"
        </span>
      </div>
    </div>
  );
}
