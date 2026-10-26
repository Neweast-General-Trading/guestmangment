"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { ScanLine } from "lucide-react";
import { scanCheckInAction } from "@/app/actions";
import { ParkingSlotField } from "@/components/parking-slot-field";

type Cam = "starting" | "live" | "blocked" | "missing";
type Gate = "in" | "out";

export function QrCheckInStation() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const qrRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const found = useRef(false);
  const gateRef = useRef<Gate>("in");
  const [gate, setGate] = useState<Gate>("in");
  const [cam, setCam] = useState<Cam>("starting");
  const [hint, setHint] = useState("Hold the visitor's invitation QR in front of the camera.");

  function choose(next: Gate) {
    gateRef.current = next;
    setGate(next);
    found.current = false;
  }

  function submit(raw: string) {
    const value = raw.trim();
    if (found.current || !value) return;
    found.current = true;
    setHint(gateRef.current === "out" ? "QR read — checking the visitor out…" : "QR read — checking the visitor in…");
    if (qrRef.current) qrRef.current.value = value;
    formRef.current?.requestSubmit();
  }

  useEffect(() => {
    let timer: number | undefined;
    let alive = true;

    async function openCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCam("missing");
        setHint("This browser has no camera. Use a USB scanner or paste the invitation link.");
        return;
      }
      const tries = [
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false },
        { video: true, audio: false },
      ] as const;
      let last: unknown;
      for (const constraints of tries) {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (error) {
          last = error;
        }
      }
      throw last;
    }

    function readFrame() {
      if (!alive || found.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState >= 2 && video.videoWidth) {
        const scale = Math.min(1, 480 / video.videoWidth);
        canvas.width = Math.floor(video.videoWidth * scale);
        canvas.height = Math.floor(video.videoHeight * scale);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: "attemptBoth" });
          if (code?.data) {
            submit(code.data);
            return;
          }
        }
      }
      timer = window.setTimeout(readFrame, 160);
    }

    async function start() {
      try {
        const stream = await openCamera();
        if (!stream) throw new Error("No camera stream");
        if (!alive) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCam("live");
        readFrame();
      } catch {
        if (alive) {
          setCam("blocked");
          setHint("Allow camera access, then refresh — or paste the invitation link below.");
        }
      }
    }

    start();
    return () => {
      alive = false;
      if (timer) window.clearTimeout(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (found.current) return;
    if (cam === "blocked" || cam === "missing") return;
    setHint(
      gate === "out"
        ? "Keep the QR inside the frame. Check-out starts as soon as it is read. Duration is calculated automatically."
        : "Keep the QR inside the frame. Check-in starts as soon as it is read.",
    );
  }, [gate, cam]);

  useEffect(() => {
    let buffer = "";
    let last = 0;
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLInputElement && target.name !== "qr") return;
      if (target instanceof HTMLTextAreaElement) return;
      const now = Date.now();
      if (now - last > 50) buffer = "";
      last = now;
      if (event.key === "Enter") {
        if (buffer.length > 10) {
          event.preventDefault();
          submit(buffer);
        }
        buffer = "";
        return;
      }
      if (event.key.length === 1) buffer += event.key;
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const leaving = gate === "out";

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="p-5">
          <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[var(--brand)]">Gate scan</div>
          <h2 className="mt-1 text-[17px] font-medium">Read the visitor QR here</h2>
          <p className="mt-1 max-w-xl text-[13px] text-[var(--muted)]">
            Same invitation QR for both. Choose Check-in or Check-out, then hold the code in the frame.
            Manual visits are recorded on the visit page — do not scan those.
          </p>

          <div className="mt-3 inline-flex rounded-lg border border-[var(--line)] bg-[#faf7f7] p-0.5">
            <ModeBtn on={!leaving} label="Check-in" onClick={() => choose("in")} />
            <ModeBtn on={leaving} label="Check-out" onClick={() => choose("out")} />
          </div>

          <div className="mt-3 flex gap-4 text-[12px] text-[var(--muted)]">
            <Step n="1" label="Show QR" />
            <Step n="2" label="Hold to camera" />
            <Step n="3" label={leaving ? "Out" : "Inside"} />
          </div>

          <form ref={formRef} action={scanCheckInAction} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input type="hidden" name="from" value="security" />
            <input type="hidden" name="gate" value={gate} />
            <label className="relative min-w-0 flex-1">
              <ScanLine size={16} strokeWidth={1.75} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--brand)]" />
              <input
                ref={qrRef}
                name="qr"
                autoComplete="off"
                placeholder="Or paste invitation link / USB scanner"
                className="h-11 w-full rounded-lg border border-[var(--line)] bg-[#faf7f7] pl-10 pr-3 text-[14px] outline-none focus:border-[var(--brand)] focus:bg-white"
              />
            </label>
            {leaving ? null : (
              <div className="w-full sm:w-52">
                <ParkingSlotField placeholder="Parking slot" />
              </div>
            )}
            <button type="submit" className="h-11 shrink-0 rounded-lg bg-[var(--brand)] px-5 text-[13px] font-medium text-white">
              {leaving ? "Check out" : "Check in"}
            </button>
          </form>
          <p className="mt-2 text-[12px] text-[var(--muted)]">{hint}</p>
        </div>

        <div className="relative min-h-[260px] bg-[#201818]">
          <video ref={videoRef} className="h-full min-h-[260px] w-full object-cover" muted playsInline autoPlay />
          <canvas ref={canvasRef} className="hidden" />
          {cam !== "live" ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="h-28 w-28 rounded-lg border-2 border-dashed border-white/40" />
              <p className="text-[13px] text-white/85">
                {cam === "starting" ? "Opening camera…" : cam === "blocked" ? "Camera blocked — allow it in the browser" : "No camera on this device"}
              </p>
            </div>
          ) : (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-36 w-36 rounded-lg border-2 border-white shadow-[0_0_0_999px_rgba(0,0,0,0.28)]" />
            </div>
          )}
          <div className="absolute bottom-3 left-0 right-0 text-center text-[11px] font-medium tracking-wide text-white/90">
            {cam === "live" ? (leaving ? "Reading QR for check-out…" : "Reading QR for check-in…") : "Camera scanner"}
          </div>
        </div>
      </div>
    </div>
  );
}

function ModeBtn({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-md px-3 text-[12px] font-medium ${
        on ? "bg-white text-[var(--brand-ink)] shadow-sm" : "text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
  );
}

function Step({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-soft)] text-[10px] font-medium text-[var(--brand-ink)]">
        {n}
      </span>
      {label}
    </div>
  );
}
