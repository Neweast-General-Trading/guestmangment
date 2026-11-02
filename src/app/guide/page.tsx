import type { Metadata } from "next";
import { GuideExplorer } from "@/components/guide-explorer";

export const metadata: Metadata = {
  title: "Guest Management guide · NEWEAST",
  description: "How a NEWEAST headquarters guest visit is requested, booked, invited, and handed to Security.",
};

const SHARE = "https://guest.neweast.cloud/guide";

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">NEWEAST Headquarters</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">Guest Management guide</h1>
      <p className="mt-2 text-[15px] text-[var(--muted)]">Choose a visit and see who is notified, who joins the meeting, and who has to act first.</p>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed">
        An employee sends a visit request, including the expected end time. When Reception confirms the booking, NEWEAST
        and AISIN people on the invitation receive a guest visit invitation they can accept. The title starts with the
        requester’s name. Guests stay off that invitation. A building tour waits for Salma Moufallah before it is sent.
      </p>
      <p className="mt-3 text-[13px] text-[var(--muted)]">
        Share:{" "}
        <a className="font-medium text-[var(--brand-ink)]" href={SHARE}>
          {SHARE}
        </a>
      </p>

      <nav className="mt-8 flex flex-wrap gap-2 text-[12px]">
        {[
          ["#flow", "Try the path"],
          ["#request", "The request"],
          ["#people", "Who does what"],
          ["#meeting", "The meeting"],
          ["#security", "Security"],
          ["#change", "Change or cancel"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5">
            {label}
          </a>
        ))}
      </nav>

      <GuideExplorer />

      <section id="request" className="mt-12">
        <h2 className="text-lg font-semibold">What the requester fills in</h2>
        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--muted)]">
          Open Visit request, complete the form, and send it. Reception has it immediately.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card title="Required">
            <ul className="list-disc space-y-1 pl-4">
              <li>Visit date, arrival time, and expected end time</li>
              <li>Department</li>
              <li>Guest type: Guest, VIP, Customer, or Supplier</li>
              <li>Title of visit. This is the meeting title on the invitation.</li>
              <li>Each guest’s full name</li>
            </ul>
          </Card>
          <Card title="Optional">
            <ul className="list-disc space-y-1 pl-4">
              <li>Visit details</li>
              <li>Mobile and email. The request is accepted when both are empty.</li>
              <li>Company, job title, and nationality</li>
              <li>ID, Passport, and Visa for each guest. Uploading none is allowed.</li>
              <li>A gate pass or a protocol gift for each guest who needs one.</li>
              <li>NEWEAST and AISIN colleagues who should join the meeting</li>
            </ul>
          </Card>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card title="Hall">
            Choose a ground-floor city hall, or N/A. N/A means Reception assigns the hall. A hall the requester picks is
            a proposal, and Reception can change it. A hall that is already booked cannot be selected. Halls on other
            floors are not offered.
          </Card>
          <Card title="Visitor Book">
            Reception can also start the visit from Meeting rooms. That books the hall at once. Phone, email, and the
            three documents stay optional there too.
          </Card>
        </div>
      </section>

      <section id="people" className="mt-12">
        <h2 className="text-lg font-semibold">Who does what</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card title="Requester">
            Any employee with Visit request. Sends the visit, proposes the hall or leaves N/A, and names the colleagues
            who should be in the meeting.
          </Card>
          <Card title="Reception — Muna">
            Receives every request, assigns the hall when it is N/A, books the hall, and owns the gate pass. She uploads
            a file for each guest when she has it, and that guest’s pass updates on the visit.
          </Card>
          <Card title="Sachini">
            Confirms a driver request. She also books rooms and assigns parking. A driver confirmation is required before
            Security can see that visit.
          </Card>
          <Card title="Salma Moufallah">
            Approves a building tour, from Building tours. A supplier visit is only a notice to her and to Hannah. If
            Salma herself sends a building-tour request, that tour is approved with the request.
          </Card>
          <Card title="Hannah Talastas">
            Receives the supplier notice, and the notice for every tour. She does not approve the visit.
          </Card>
          <Card title="Jesman Muruganantham">
            Prepares a protocol gift for each guest who needs one. When the visit includes any tour, she also receives the
            guest visit invitation.
          </Card>
          <Card title="Samir Ibrahim">
            On a customer visit, he receives the Outlook meeting plus email and Teams with the full details after the hall
            accepts. He does not approve the visit.
          </Card>
          <Card title="Security">
            Sees the visit after the hall is set and after any driver, gate pass, or building-tour approval on that visit
            is finished. The desk then checks the guest in.
          </Card>
        </div>
      </section>

      <section id="meeting" className="mt-12">
        <h2 className="text-lg font-semibold">The Outlook meeting</h2>
        <div className="mt-4 space-y-3">
          <Card title="When it is sent">
            Reception’s confirmation sends a guest visit invitation. The meeting title comes first, with the requester’s
            name beside it, then the date and the room. The guest mailbox only sends it. Accept adds it to the calendar.
            A building tour waits for Salma first, unless she is the requester.
          </Card>
          <Card title="Who is on it">
            The requester, the invited NEWEAST and AISIN colleagues, and the case contacts for that visit: Samir for a
            customer, Hannah and Salma for a supplier, and Hannah, Salma, and Jesman for any tour. The invitation shows
            the meeting title, the requester’s name, the date, and the room.
          </Card>
          <Card title="Who is left off it">
            Every guest, including addresses outside NEWEAST and AISIN. A later change of hall or time, and a
            cancellation, go to the same invited people. The cancellation includes the reason, and a reason is required.
          </Card>
        </div>
      </section>

      <section id="security" className="mt-12">
        <h2 className="text-lg font-semibold">Before Security can see the visit</h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed">
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">A ground-floor city hall is chosen.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If a driver was requested, Sachini has confirmed it.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If a gate pass was requested, Muna has uploaded a file for each guest who needs one.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If it is a building tour, Salma has approved it. A supplier visit and a ground-floor tour do not wait for approval.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">A gift never holds Security, the hall, or the meeting.</li>
        </ul>
      </section>

      <section id="change" className="mt-12">
        <h2 className="text-lg font-semibold">Change or cancel</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card title="Hall or time changes">
            The company people on the meeting receive an email with the new hall and time, and their Outlook event is
            updated.
          </Card>
          <Card title="The visit is cancelled">
            The Outlook event is removed. Those same company people receive an email that it was cancelled, including the
            reason. Write the reason before cancelling.
          </Card>
        </div>
      </section>

      <p className="mt-12 border-t border-[var(--line)] pt-6 text-[12px] leading-relaxed text-[var(--muted)]">
        Guest Management · {SHARE}
      </p>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{children}</div>
    </div>
  );
}
