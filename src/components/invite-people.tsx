"use client";

import { useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { cancelInviteeAction } from "@/app/actions";
import { Textarea, inputClass } from "@/components/ui";
import { matches } from "@/lib/paging";

export function InvitePeople({
  people,
  bookerEmail,
  initial = [],
  hint = "They receive a guest visit invitation when Reception confirms the booking.",
  cancelVisitId,
}: {
  people: { value: string; label: string; hint?: string }[];
  bookerEmail: string;
  initial?: { email: string; name: string }[];
  hint?: string;
  cancelVisitId?: string;
}) {
  const booker = bookerEmail.trim().toLowerCase();
  const saved = new Set(initial.map((item) => item.email.trim().toLowerCase()));
  const [picked, setPicked] = useState<{ email: string; name: string }[]>(
    initial.filter((item) => item.email.trim().toLowerCase() !== booker),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const chosen = new Set(picked.map((item) => item.email));
  const options = people.filter((item) => {
    const email = item.value.trim().toLowerCase();
    return email.includes("@") && email !== booker && !chosen.has(email);
  });
  const filtered = options.filter((item) => matches(`${item.label} ${item.hint ?? ""} ${item.value}`, query)).slice(0, 8);

  function add(email: string, name: string) {
    const value = email.trim().toLowerCase();
    if (!value.includes("@") || value === booker || chosen.has(value) || picked.length >= 20) return;
    setPicked((current) => [...current, { email: value, name: name.trim() || value.split("@")[0] || value }]);
    setQuery("");
    setOpen(false);
  }

  function addTyped() {
    for (const part of query.split(/[\s,;]+/)) add(part, "");
  }

  return (
    <div>
      <div className="mb-1.5 text-[12px] font-medium text-[var(--muted)]">Invite people</div>
      <p className="mb-2 text-[11px] text-[var(--muted)]">{hint}</p>
      {picked.length ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {picked.map((item) => (
            <span key={item.email} className="inline-flex items-center gap-1 rounded-full border border-[var(--line)] bg-[#faf7f7] px-2 py-0.5 text-[11px]">
              {item.name}
              {cancelVisitId && saved.has(item.email) ? (
                <CancelPerson
                  visitId={cancelVisitId}
                  person={item}
                  onDone={() => setPicked((current) => current.filter((row) => row.email !== item.email))}
                />
              ) : (
                <button
                  type="button"
                  className="cursor-pointer text-[var(--muted)] hover:text-[#b14a42]"
                  onClick={() => setPicked((current) => current.filter((row) => row.email !== item.email))}
                  aria-label={`Remove ${item.name}`}
                >
                  ×
                </button>
              )}
              <input type="hidden" name="inviteEmail" value={item.email} />
            </span>
          ))}
        </div>
      ) : null}
      <div className="relative">
        <input
          className={inputClass}
          value={query}
          placeholder="Name or email"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (filtered[0] && !query.includes("@")) add(filtered[0].value, filtered[0].label);
            else addTyped();
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
        />
        {open && (filtered.length || query.includes("@")) ? (
          <div className="absolute z-30 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-[var(--line)] bg-white shadow-[0_12px_32px_rgba(26,21,21,0.12)]">
            {filtered.map((item) => (
              <button
                key={item.value}
                type="button"
                className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4]"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => add(item.value, item.label)}
              >
                <span className="block font-medium">{item.label}</span>
                {item.hint ? <span className="block text-[12px] text-[var(--muted)]">{item.hint}</span> : null}
              </button>
            ))}
            {query.includes("@") ? (
              <button type="button" className="block w-full px-3 py-2 text-left text-[13px] hover:bg-[#faf4f4]" onMouseDown={(event) => event.preventDefault()} onClick={addTyped}>
                Add {query.trim()}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CancelPerson({
  visitId,
  person,
  onDone,
}: {
  visitId: string;
  person: { email: string; name: string };
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    if (pending) return;
    setReason("");
    setError("");
    setOpen(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const note = reason.trim();
    if (!note || pending) return;
    setPending(true);
    setError("");
    const formData = new FormData();
    formData.set("visitId", visitId);
    formData.set("email", person.email);
    formData.set("reason", note);
    const result = await cancelInviteeAction(formData);
    setPending(false);
    if (!result || !("ok" in result)) {
      setError(result && "error" in result && result.error ? result.error : "Could not cancel this person.");
      return;
    }
    setOpen(false);
    setReason("");
    onDone();
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Cancel ${person.name}`}
        className="cursor-pointer font-medium text-[#b14a42]"
        onClick={() => setOpen(true)}
      >
        Cancel
      </button>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[rgba(26,21,21,0.45)] p-4" onClick={close}>
              <form
                role="dialog"
                aria-modal="true"
                aria-labelledby="cancel-person-title"
                className="w-full max-w-md rounded-2xl border border-[var(--line)] bg-white p-5 shadow-lg"
                onClick={(event) => event.stopPropagation()}
                onSubmit={submit}
              >
                <h2 id="cancel-person-title" className="text-base font-semibold">
                  Cancellation reason
                </h2>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  Cancel {person.name} from this meeting. Everyone else stays. Nothing is sent until you submit.
                </p>
                <Textarea
                  required
                  autoFocus
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Cancellation reason"
                  aria-label="Cancellation reason"
                  className="mt-3 min-h-24"
                />
                {error ? <p className="mt-2 text-[13px] text-[#b14a42]">{error}</p> : null}
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={close}
                    className="inline-flex h-9 items-center justify-center rounded-md px-3 text-[13px] text-[var(--muted)] hover:text-[var(--ink)]"
                  >
                    Keep
                  </button>
                  <button
                    type="submit"
                    disabled={!reason.trim() || pending}
                    className="inline-flex h-9 items-center justify-center rounded-md bg-[#b14a42] px-3 text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Submit
                  </button>
                </div>
              </form>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
