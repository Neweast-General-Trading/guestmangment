"use client";

import { useEffect, useMemo, useState } from "react";

type Kind = "GUEST" | "VIP" | "CUSTOMER" | "SUPPLIER";
type Tour = "NONE" | "GF" | "BUILDING";
type RoomChoice = "HALL" | "NA";

type Scenario = {
  kind: Kind;
  tour: Tour;
  room: RoomChoice;
  driver: boolean;
  gate: boolean;
  gift: boolean;
  salmaRequester: boolean;
};

type Line = { who: string; what: string };

const KINDS: { id: Kind; label: string }[] = [
  { id: "GUEST", label: "Guest" },
  { id: "VIP", label: "VIP" },
  { id: "CUSTOMER", label: "Customer" },
  { id: "SUPPLIER", label: "Supplier" },
];

const TOURS: { id: Tour; label: string }[] = [
  { id: "NONE", label: "No tour" },
  { id: "GF", label: "Ground floor" },
  { id: "BUILDING", label: "Building" },
];

const STEPS = ["Request", "Notices", "Room", "Meeting", "Security"] as const;

function kindLabel(kind: Kind) {
  return KINDS.find((item) => item.id === kind)?.label || kind;
}

function requestLines(scenario: Scenario): Line[] {
  const lines: Line[] = [
    {
      who: "Reception",
      what: "Muna receives the request at once. The hall is the one the requester chose, or N/A when Reception must assign it.",
    },
  ];
  if (scenario.kind === "SUPPLIER") {
    lines.push({
      who: "Hannah Talastas and Salma Moufallah",
      what: "Both receive an email and a Teams message with the full visit details. A supplier visit needs no approval, and it does not wait.",
    });
  }
  if (scenario.tour === "GF") {
    lines.push({
      who: "Hannah Talastas and Salma Moufallah",
      what: "Both are told that a ground-floor tour was requested. This notice does not hold the visit.",
    });
  }
  if (scenario.tour === "BUILDING" && scenario.salmaRequester) {
    lines.push({
      who: "Salma Moufallah",
      what: "She is the requester, so the building tour is approved together with the request.",
    });
    lines.push({
      who: "Hannah Talastas",
      what: "She is still told, by email and Teams, that a building tour was requested.",
    });
  }
  if (scenario.tour === "BUILDING" && !scenario.salmaRequester) {
    lines.push({
      who: "Salma Moufallah",
      what: "She receives an approval request by email and Teams. The meeting invitation and Security both wait until she approves.",
    });
    lines.push({
      who: "Hannah Talastas",
      what: "She is told that a building tour was requested. She does not approve it.",
    });
  }
  if (scenario.driver) {
    lines.push({
      who: "Sachini",
      what: "She receives the driver request and confirms it. Security waits for her confirmation. The meeting invitation does not.",
    });
  }
  if (scenario.gate) {
    lines.push({
      who: "Muna",
      what: "She approves the gate pass and uploads the file. Security waits for that file. The meeting invitation does not.",
    });
  }
  if (scenario.gift) {
    lines.push({
      who: "Jesman Muruganantham",
      what: "She receives the gift preparation request. The gift does not hold the room, the meeting, or Security.",
    });
  }
  if (scenario.kind === "CUSTOMER") {
    lines.push({
      who: "Samir Ibrahim",
      what: "He is not told at this step. His Outlook invitation goes out when Reception confirms the booking.",
    });
  }
  return lines;
}

function meetingLines(scenario: Scenario): Line[] {
  const lines: Line[] = [
    { who: "Requester", what: "A guest visit invitation. The meeting title is first, their name is beside it, then the date and the room. Accept adds it to the calendar." },
    { who: "Invited colleagues", what: "The same invitation, for NEWEAST and AISIN addresses named on the request." },
    { who: "Reception", what: "Already holds the meeting, because Reception booked the hall and is the organizer." },
  ];
  if (scenario.kind === "CUSTOMER") {
    lines.push({
      who: "Samir Ibrahim",
      what: "Outlook meeting, plus an email and a Teams message with the full visit details. He does not approve the visit.",
    });
  }
  if (scenario.kind === "SUPPLIER") {
    lines.push({
      who: "Hannah Talastas and Salma Moufallah",
      what: "Outlook meeting, plus an email and a Teams message with the full visit details.",
    });
  }
  if (scenario.tour === "GF" || scenario.tour === "BUILDING") {
    lines.push({
      who: "Hannah, Salma, and Jesman",
      what: "All three receive the Outlook meeting. Jesman is added here because there is a tour. A gift, if one was requested, was already sent to her as a separate preparation request.",
    });
  }
  lines.push({
    who: "Guests",
    what: "They stay off the meeting, even when an email address was entered. They also stay off later change and cancellation emails.",
  });
  return lines;
}

function securityLines(scenario: Scenario): Line[] {
  const lines: Line[] = [{ who: "Meeting room", what: "A ground-floor city hall is set. N/A is not enough for Security." }];
  if (scenario.tour === "BUILDING" && !scenario.salmaRequester) {
    lines.push({ who: "Salma Moufallah", what: "The building tour is approved." });
  }
  if (scenario.driver) lines.push({ who: "Sachini", what: "The driver request is confirmed." });
  if (scenario.gate) lines.push({ who: "Muna", what: "The gate pass is approved and the file is uploaded." });
  if (!scenario.driver && !scenario.gate && (scenario.tour !== "BUILDING" || scenario.salmaRequester)) {
    lines.push({ who: "Nothing else", what: "This visit has no driver, gate pass, or building-tour approval left to finish." });
  }
  lines.push({ who: "Security", what: "The guard desk then sees the visit and can check the guest in." });
  return lines;
}

function headline(scenario: Scenario) {
  const bits = [kindLabel(scenario.kind)];
  if (scenario.tour === "GF") bits.push("ground-floor tour");
  if (scenario.tour === "BUILDING") bits.push(scenario.salmaRequester ? "building tour, sent by Salma" : "building tour");
  if (scenario.room === "NA") bits.push("room left as N/A");
  if (scenario.driver) bits.push("driver");
  if (scenario.gate) bits.push("gate pass");
  if (scenario.gift) bits.push("gift");
  return bits.join(" · ");
}

function stepBody(scenario: Scenario, index: number) {
  if (index === 0) {
    return {
      title: "The employee sends the request",
      lead: "Visit request goes to Reception immediately. There is no line-manager approval on this form.",
      lines: [
        { who: "Required", what: "Date, arrival time, expected end, department, guest type, title of visit, and each guest’s full name." },
        { who: "Optional", what: "Visit details, mobile, email, company, job title, nationality, and NEWEAST or AISIN colleagues to invite." },
        { who: "Documents", what: "ID, Passport, and Visa for each guest. None of them is required." },
        {
          who: "Hall",
          what:
            scenario.room === "NA"
              ? "N/A is selected. Reception will choose a free ground-floor city hall."
              : "A ground-floor city hall is proposed. Reception can still change it. A hall that is already booked cannot be selected.",
        },
      ] satisfies Line[],
    };
  }
  if (index === 1) {
    return {
      title: "Notices go out with the request",
      lead: "These messages leave as soon as the request is sent. They use email and Teams, with the visit details.",
      lines: requestLines(scenario),
    };
  }
  if (index === 2) {
    const waiting = scenario.tour === "BUILDING" && !scenario.salmaRequester;
    return {
      title: "Reception books the hall",
      lead: waiting
        ? "Reception can prepare the hall. The Outlook invitation waits until Salma approves the building tour."
        : "Reception books a free ground-floor city hall. The Outlook invitation goes to NEWEAST and AISIN people on the request.",
      lines: [
        {
          who: scenario.room === "NA" ? "Reception chooses the hall" : "Reception checks the proposed hall",
          what: "Only ground-floor city halls can be booked here, such as Tokyo or Shanghai. Other floors stay out of Guest Management.",
        },
        { who: "The invitation", what: "The requester, the invited NEWEAST and AISIN colleagues, and the case contacts receive a guest visit invitation. It shows the meeting title, the requester’s name, the date, and the room. Guests do not." },
      ],
    };
  }
  if (index === 3) {
    const waiting = scenario.tour === "BUILDING" && !scenario.salmaRequester;
    return {
      title: "Reception confirms, then the invitation goes out",
      lead: waiting
        ? "After Salma approves, Reception’s Outlook invitation goes to NEWEAST and AISIN mailboxes. Guests stay off it."
        : "As soon as Reception confirms the booking, the email goes to company mailboxes only.",
      lines: meetingLines(scenario),
    };
  }
  const waits = [
    scenario.tour === "BUILDING" && !scenario.salmaRequester ? "Salma’s building-tour approval" : "",
    scenario.driver ? "Sachini’s driver confirmation" : "",
    scenario.gate ? "Muna’s uploaded gate pass" : "",
  ].filter(Boolean);
  return {
    title: "Reception sends it to Security",
    lead: waits.length
      ? `Security sees the visit after the hall is set and after ${waits.join(", ")}.`
      : "Security sees the visit once the hall is set.",
    lines: securityLines(scenario),
  };
}

export function GuideExplorer() {
  const [scenario, setScenario] = useState<Scenario>({
    kind: "GUEST",
    tour: "NONE",
    room: "NA",
    driver: false,
    gate: false,
    gift: false,
    salmaRequester: false,
  });
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const body = useMemo(() => stepBody(scenario, step), [scenario, step]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setStep((current) => {
        if (current >= STEPS.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [playing, step]);

  function patch(next: Partial<Scenario>) {
    setPlaying(false);
    setScenario((current) => ({ ...current, ...next }));
  }

  return (
    <section id="flow" className="mt-10 rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Try the path</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-[var(--muted)]">
            Choose the visit, then open each step. The people and the waits change with the choices.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (playing) {
              setPlaying(false);
              return;
            }
            if (step >= STEPS.length - 1) setStep(0);
            setPlaying(true);
          }}
          className="h-9 rounded-full bg-[var(--brand)] px-4 text-[13px] font-medium text-white"
        >
          {playing ? "Pause" : "Play the path"}
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <Chooser label="Guest type">
          {KINDS.map((item) => (
            <Chip key={item.id} active={scenario.kind === item.id} onClick={() => patch({ kind: item.id })}>
              {item.label}
            </Chip>
          ))}
        </Chooser>
        <Chooser label="Tour">
          {TOURS.map((item) => (
            <Chip key={item.id} active={scenario.tour === item.id} onClick={() => patch({ tour: item.id })}>
              {item.label}
            </Chip>
          ))}
        </Chooser>
        <Chooser label="Hall on the request">
          <Chip active={scenario.room === "HALL"} onClick={() => patch({ room: "HALL" })}>
            A city hall
          </Chip>
          <Chip active={scenario.room === "NA"} onClick={() => patch({ room: "NA" })}>
            N/A
          </Chip>
        </Chooser>
        <Chooser label="Also on the request">
          <Chip active={scenario.driver} onClick={() => patch({ driver: !scenario.driver })}>
            Driver
          </Chip>
          <Chip active={scenario.gate} onClick={() => patch({ gate: !scenario.gate })}>
            Gate pass
          </Chip>
          <Chip active={scenario.gift} onClick={() => patch({ gift: !scenario.gift })}>
            Gift
          </Chip>
          {scenario.tour === "BUILDING" ? (
            <Chip active={scenario.salmaRequester} onClick={() => patch({ salmaRequester: !scenario.salmaRequester })}>
              Salma is the requester
            </Chip>
          ) : null}
        </Chooser>
      </div>

      <p className="mt-4 text-[12px] font-medium text-[var(--brand-ink)]">{headline(scenario)}</p>

      <ol className="mt-4 grid gap-2 sm:grid-cols-5">
        {STEPS.map((label, index) => {
          const active = index === step;
          return (
            <li key={label}>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  setStep(index);
                }}
                className={`flex w-full items-center gap-2 rounded-2xl border px-3 py-3 text-left ${
                  active ? "border-[var(--brand)] bg-[var(--brand-soft)]" : "border-[var(--line)] bg-[var(--bg)]"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                    active ? "bg-[var(--brand)] text-white" : "bg-white text-[var(--muted)]"
                  }`}
                >
                  {index + 1}
                </span>
                <span className="text-[13px] font-semibold">{label}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 rounded-2xl bg-[var(--bg)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold">{body.title}</h3>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => {
                setPlaying(false);
                setStep((current) => Math.max(0, current - 1));
              }}
              className="h-8 rounded-full border border-[var(--line)] bg-white px-3 text-[12px] disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={step === STEPS.length - 1}
              onClick={() => {
                setPlaying(false);
                setStep((current) => Math.min(STEPS.length - 1, current + 1));
              }}
              className="h-8 rounded-full border border-[var(--line)] bg-white px-3 text-[12px] disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
        <p className="mt-2 text-[14px] leading-relaxed">{body.lead}</p>
        <ul className="mt-4 space-y-2">
          {body.lines.map((line) => (
            <li key={`${line.who}-${line.what}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-3">
              <div className="text-[13px] font-semibold">{line.who}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{line.what}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Chooser({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="w-40 shrink-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`h-8 rounded-full border px-3 text-[12px] font-medium ${
        active ? "border-[var(--brand)] bg-[var(--brand)] text-white" : "border-[var(--line)] bg-white text-[var(--ink)]"
      }`}
    >
      {children}
    </button>
  );
}
