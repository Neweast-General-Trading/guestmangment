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
      what: "Muna receives the request at once. The hall is the one the requester chose, or N/A when Reception must assign it. Choosing a hall here does not book it in Outlook yet.",
    },
  ];
  if (scenario.kind !== "CUSTOMER") {
    lines.push({
      who: "Sawsan Atia Rashad Hussein",
      what: "She receives one information email: the title, the date, the guest names, and the requester. This is not a calendar invitation, and it is not sent again on every save. A customer visit does not send her this email.",
    });
  }
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
      what: "She receives an approval request by email and Teams. Security waits until she approves. The calendar invitation does not: it goes out when the meeting room accepts.",
    });
    lines.push({
      who: "Hannah Talastas",
      what: "She is told that a building tour was requested. She does not approve it.",
    });
  }
  if (scenario.driver) {
    lines.push({
      who: "Sachini",
      what: "She receives the driver request and confirms it. Security waits for her confirmation. The calendar invitation does not.",
    });
  }
  if (scenario.gate) {
    lines.push({
      who: "Muna",
      what: "The gate pass is one choice for every guest. She approves it, then uploads the file. Security waits for that file. The calendar invitation does not.",
    });
  }
  if (scenario.gift) {
    lines.push({
      who: "Jesman Muruganantham",
      what: "The protocol gift is one choice for every guest, with one gift type. She receives the preparation request. The gift does not hold the room, the meeting, or Security.",
    });
  }
  if (scenario.kind === "CUSTOMER") {
    lines.push({
      who: "Samir Ibrahim",
      what: "He is not told at this step. His calendar invitation goes out when the meeting room accepts.",
    });
  }
  return lines;
}

function meetingLines(scenario: Scenario): Line[] {
  const lines: Line[] = [
    {
      who: "Requester",
      what: "A calendar invitation. The subject is the visit title, then the requester’s full name. The message has the date and the room. Accept adds it to the calendar.",
    },
    {
      who: "Invitation team",
      what: "The same invitation, for each NEWEAST or AISIN colleague named on the request. Their names are listed on the visit card and on the meeting page.",
    },
    {
      who: "Reception",
      what: "The hall booking stays on the guest mailbox and on the room calendar. Personal calendars receive the meeting from the invitation, not from the room booking itself.",
    },
  ];
  if (scenario.kind === "CUSTOMER") {
    lines.push({
      who: "Samir Ibrahim",
      what: "He is added to the calendar invitation, and he receives an email and a Teams message with the full visit details. He does not approve the visit.",
    });
  }
  if (scenario.kind === "SUPPLIER") {
    lines.push({
      who: "Hannah Talastas and Salma Moufallah",
      what: "Both are added to the calendar invitation, and both receive an email and a Teams message with the full visit details.",
    });
  }
  if (scenario.tour === "GF" || scenario.tour === "BUILDING") {
    lines.push({
      who: "Hannah, Salma, and Jesman",
      what: "All three are added to the calendar invitation because there is a tour. A gift, if one was requested, was already sent to Jesman as a separate preparation request.",
    });
  }
  lines.push({
    who: "Someone put back on the list",
    what: "If a colleague was removed and then added again, the meeting is placed directly on that person’s calendar. They do not have to press Accept.",
  });
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
        { who: "Documents", what: "ID, Passport, and Visa for each guest. None of them is required. A file already uploaded stays in place when the request is edited. A new file replaces only that slot." },
        { who: "For every guest", what: "Gate pass and protocol gift are each one checkbox for the whole visit. The gift type appears only when the gift box is checked." },
        { who: "Invitation team", what: "NEWEAST and AISIN colleagues who should join the meeting. Addresses outside those companies are not invited." },
        {
          who: "Hall",
          what:
            scenario.room === "NA"
              ? "N/A is selected. Reception will choose a free city hall: Berlin, Dubai, Riyadh, Shanghai, or Tokyo."
              : "One of Berlin, Dubai, Riyadh, Shanghai, or Tokyo is proposed. Reception can still change it. A hall that is already booked cannot be selected. The choice does not book Outlook yet.",
        },
      ] satisfies Line[],
    };
  }
  if (index === 1) {
    return {
      title: "Notices go out with the request",
      lead: "These messages leave once, when the request is sent. An information email is not a calendar invitation. Saving the request again does not send them a second time.",
      lines: requestLines(scenario),
    };
  }
  if (index === 2) {
    return {
      title: "Reception books the hall",
      lead: "Preparing means the meeting room has not accepted yet. After it accepts, the status becomes Meeting room confirmed while anything else is still open. Ready means the hall, the driver, the gate pass, the gift, and any building tour are finished.",
      lines: [
        {
          who: scenario.room === "NA" ? "Reception chooses the hall" : "Reception checks the proposed hall",
          what: "Only Berlin, Dubai, Riyadh, Shanghai, and Tokyo can be booked. Other floors stay out of Guest Management. A booked hall cannot be selected.",
        },
        {
          who: "Preparing",
          what: "Confirm is hidden. Save keeps edits. Submit to Security is refused until the hall is set and any driver, gate pass, or building-tour approval on this visit is finished.",
        },
        {
          who: "Meeting room confirmed",
          what: "The room has accepted, or the calendar invitation has gone out, and something else is still open. Confirm stays hidden.",
        },
        {
          who: "Ready",
          what: "The hall, the driver, the gate pass, the gift, and any building tour are finished. Confirm appears only if the calendar invitation has not gone out yet.",
        },
      ],
    };
  }
  if (index === 3) {
    return {
      title: "The meeting room accepts, then the invitation goes out",
      lead: "The calendar invitation is sent once, when the meeting room accepts. It does not wait for the driver, the gate pass, the gift, or Salma’s building-tour approval. It is not sent again to people who already received it.",
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

const GUIDE_PAGES = [
  { id: "request", label: "What the requester fills in" },
  { id: "people", label: "Who does what" },
  { id: "meeting", label: "The Outlook meeting" },
  { id: "security", label: "Before Security can see the visit" },
  { id: "change", label: "Change or cancel" },
];

function Mark({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (needle.length < 2) return <>{text}</>;
  const lower = text.toLowerCase();
  const want = needle.toLowerCase();
  const parts: React.ReactNode[] = [];
  let from = 0;
  let at = lower.indexOf(want);
  while (at >= 0) {
    if (at > from) parts.push(text.slice(from, at));
    parts.push(
      <mark key={`${at}-${from}`} className="rounded bg-[#f8e7b2] px-0.5 text-[var(--ink)]">
        {text.slice(at, at + want.length)}
      </mark>,
    );
    from = at + want.length;
    at = lower.indexOf(want, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return <>{parts}</>;
}

export function GuideExplorer({ before, children }: { before?: React.ReactNode; children?: React.ReactNode }) {
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
  const bodies = useMemo(() => STEPS.map((_, index) => stepBody(scenario, index)), [scenario]);
  const [query, setQuery] = useState("");
  const [pageText, setPageText] = useState<Record<string, string>>({});
  const needle = query.trim().toLowerCase();
  const searching = needle.length >= 2;

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const page of GUIDE_PAGES) next[page.id] = document.getElementById(page.id)?.innerText || "";
    setPageText(next);
  }, [children]);

  const otherHits = useMemo(() => {
    if (!searching) return [];
    const seen = new Set<string>();
    for (const [index, item] of bodies.entries()) {
      for (const line of item.lines) {
        if (`${item.title} ${item.lead} ${line.who} ${line.what}`.toLowerCase().includes(needle)) seen.add(`${index}|${line.who}|${line.what}`);
      }
    }
    const hits: { key: string; step: number; who: string; scenario: Scenario; label: string }[] = [];
    for (const kind of KINDS) {
      for (const tour of TOURS) {
        for (const room of ["HALL", "NA"] as RoomChoice[]) {
          for (const driver of [false, true]) {
            for (const gate of [false, true]) {
              for (const gift of [false, true]) {
                const salmaOptions = tour.id === "BUILDING" ? [false, true] : [false];
                for (const salmaRequester of salmaOptions) {
                  const next: Scenario = { kind: kind.id, tour: tour.id, room, driver, gate, gift, salmaRequester };
                  for (let index = 0; index < STEPS.length; index += 1) {
                    const item = stepBody(next, index);
                    for (const line of item.lines) {
                      const blob = `${line.who} ${line.what}`.toLowerCase();
                      if (!blob.includes(needle)) continue;
                      const key = `${index}|${line.who}|${line.what}`;
                      if (seen.has(key)) continue;
                      seen.add(key);
                      hits.push({ key, step: index, who: line.who, scenario: next, label: headline(next) });
                      if (hits.length >= 6) return hits;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    return hits;
  }, [bodies, needle, searching]);

  function chooseStep(index: number) {
    setPlaying(false);
    setStep(index);
    document.getElementById("flow")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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

  const pages = GUIDE_PAGES.filter((page) => !searching || `${page.label} ${pageText[page.id] || ""}`.toLowerCase().includes(needle));
  const flowVisible = bodies.some((item, index) => {
    if (!searching) return true;
    const blob = `${STEPS[index]} ${item.title} ${item.lead} ${item.lines.map((line) => `${line.who} ${line.what}`).join(" ")}`.toLowerCase();
    return blob.includes(needle);
  });

  return (
    <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
      <aside className="lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:w-72 lg:shrink-0 lg:overflow-y-auto">
        <label className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]" htmlFor="guide-search">
          Search
        </label>
        <input
          id="guide-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the guide"
          className="mt-2 h-10 w-full rounded-xl border border-[var(--line)] bg-white px-3 text-[13px] outline-none focus:border-[var(--brand)]"
        />
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Flow</div>
          {flowVisible ? (
            <ol className="mt-2 border-l border-[var(--line)]">
              {bodies.map((item, index) => {
                const blob = `${STEPS[index]} ${item.title} ${item.lead} ${item.lines.map((line) => `${line.who} ${line.what}`).join(" ")}`.toLowerCase();
                if (searching && !blob.includes(needle)) return null;
                const lines = searching
                  ? item.lines.filter((line) => `${item.title} ${item.lead} ${line.who} ${line.what}`.toLowerCase().includes(needle))
                  : item.lines;
                const open = searching || index === step;
                return (
                  <li key={STEPS[index]} className="ml-3 py-1">
                    <button
                      type="button"
                      onClick={() => chooseStep(index)}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] font-semibold ${
                        index === step ? "bg-[var(--brand-soft)] text-[var(--brand-ink)]" : "text-[var(--ink)] hover:bg-[var(--bg)]"
                      }`}
                    >
                      <span className="text-[11px] text-[var(--muted)]">{index + 1}</span>
                      {STEPS[index]}
                    </button>
                    {open ? (
                      <ul className="mt-1 space-y-0.5 pl-4">
                        {lines.map((line) => (
                          <li key={`${STEPS[index]}-${line.who}`}>
                            <button
                              type="button"
                              onClick={() => chooseStep(index)}
                              className="w-full rounded-md px-2 py-1 text-left text-[12px] text-[var(--muted)] hover:bg-[var(--bg)] hover:text-[var(--ink)]"
                            >
                              <Mark text={line.who} query={query} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="mt-2 text-[12px] text-[var(--muted)]">Nothing in this visit matches.</p>
          )}
        </div>
        {searching && otherHits.length ? (
          <div className="mt-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">Also in other visits</div>
            <ul className="mt-2 space-y-1">
              {otherHits.map((hit) => (
                <li key={hit.key}>
                  <button
                    type="button"
                    onClick={() => {
                      setPlaying(false);
                      setScenario(hit.scenario);
                      setStep(hit.step);
                      document.getElementById("flow")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-[var(--bg)]"
                  >
                    <div className="text-[12px] font-semibold">
                      {STEPS[hit.step]} · <Mark text={hit.who} query={query} />
                    </div>
                    <div className="text-[11px] text-[var(--muted)]">{hit.label}</div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--faint)]">In this guide</div>
          <ul className="mt-2 space-y-1">
            {pages.map((page) => (
              <li key={page.id}>
                <a href={`#${page.id}`} className="block rounded-lg px-2 py-1.5 text-[13px] hover:bg-[var(--bg)]">
                  {page.label}
                </a>
              </li>
            ))}
            {searching && !pages.length ? <li className="px-2 text-[12px] text-[var(--muted)]">No section matches.</li> : null}
          </ul>
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        {before}
    <section id="flow" className="mt-8 rounded-3xl border border-[var(--line)] bg-white p-4 sm:p-6">
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

      <div className="mt-4 rounded-2xl bg-[var(--bg)] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[16px] font-semibold">
            <Mark text={body.title} query={query} />
          </h3>
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
        <p className="mt-2 text-[14px] leading-relaxed">
          <Mark text={body.lead} query={query} />
        </p>
        <ul className="mt-4 space-y-2">
          {body.lines.map((line) => (
            <li key={`${line.who}-${line.what}`} className="rounded-xl border border-[var(--line)] bg-white px-3 py-3">
              <div className="text-[13px] font-semibold">
                <Mark text={line.who} query={query} />
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">
                <Mark text={line.what} query={query} />
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
        {children}
      </div>
    </div>
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
