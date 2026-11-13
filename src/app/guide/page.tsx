import type { Metadata } from "next";
import { GuideExplorer } from "@/components/guide-explorer";

export const metadata: Metadata = {
  title: "Guest Management guide · NEWEAST",
  description: "How a NEWEAST headquarters guest visit is requested, booked, invited, and handed to Security.",
};

const SHARE = "https://guest.neweast.cloud/guide";

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <GuideExplorer
        before={
          <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">NEWEAST Headquarters</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">Guest Management guide</h1>
      <p className="mt-2 text-[15px] text-[var(--muted)]">Choose a visit and see who is notified, who joins the meeting, and who has to act first.</p>
      <p className="mt-4 max-w-3xl text-[15px] leading-relaxed">
        An employee sends a visit request. Reception books one of the city halls: Berlin, Dubai, Riyadh, Shanghai, or
        Tokyo. When that room accepts, the calendar invitation goes once to the requester and the invitation team. The
        subject is the visit title, then the requester’s name. Guests stay off it. Driver, gate pass, gift, and a
        building-tour approval do not hold that invitation. Security still waits for the hall, the driver, the gate pass,
        and Salma’s approval when the tour is of the whole building.
      </p>
      <p className="mt-3 text-[13px] text-[var(--muted)]">
        Share:{" "}
        <a className="font-medium text-[var(--brand-ink)]" href={SHARE}>
          {SHARE}
        </a>
      </p>

          </>
        }
      >
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
              <li>ID, Passport, and Visa for each guest. Uploading none is allowed. A saved file stays when the request is edited.</li>
              <li>One gate-pass checkbox and one protocol-gift checkbox for every guest. The gift type appears only when the gift is checked.</li>
              <li>The invitation team: NEWEAST and AISIN colleagues who should join the meeting</li>
            </ul>
          </Card>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Card title="Hall">
            Choose Berlin, Dubai, Riyadh, Shanghai, or Tokyo, or leave N/A. N/A means Reception assigns the hall. A hall
            the requester picks is a proposal, and it does not book Outlook yet. Reception can change it. A hall that is
            already booked cannot be selected. Halls on other floors are not offered.
          </Card>
          <Card title="Visitor Book">
            Reception can also start the visit from Meeting rooms. That books the hall at once. Phone, email, and the
            three documents stay optional there too. Gate pass and protocol gift are still one choice for every guest.
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
            Receives every request, assigns the hall when it is N/A, books the hall, and owns the gate pass. The gate pass
            is one choice for every guest. She approves it, then uploads the file.
          </Card>
          <Card title="Sachini">
            Confirms a driver request. She also books rooms and assigns parking. A driver confirmation is required before
            Security can see that visit. It is not required before the calendar invitation.
          </Card>
          <Card title="Salma Moufallah">
            Approves a building tour. Security waits for that approval. The calendar invitation does not. A supplier visit
            is only a notice to her and to Hannah. If Salma herself sends a building-tour request, that tour is approved
            with the request.
          </Card>
          <Card title="Hannah Talastas">
            Receives the supplier notice, and the notice for every tour. She joins the calendar invitation for a supplier
            visit and for any tour. She does not approve the visit.
          </Card>
          <Card title="Sawsan Atia Rashad Hussein">
            Receives one information email when a Guest, VIP, or Supplier request is sent. It names the title, the date,
            the guests, and the requester. It is not a calendar invitation, and a customer visit does not send it.
          </Card>
          <Card title="Jesman Muruganantham">
            Prepares the protocol gift for the visit. The gift is one choice and one type for every guest. When the visit
            includes any tour, she also joins the calendar invitation. The gift does not hold Security.
          </Card>
          <Card title="Samir Ibrahim">
            On a customer visit, he joins the calendar invitation when the hall accepts, and he receives email and Teams
            with the full details. He does not approve the visit.
          </Card>
          <Card title="Security">
            Sees the visit after Reception submits it. Submit succeeds when the hall is set, Sachini has confirmed a
            requested driver, Muna has uploaded a requested gate pass, and Salma has approved a building tour. A gift
            never holds this step.
          </Card>
        </div>
      </section>

      <section id="meeting" className="mt-12">
        <h2 className="text-lg font-semibold">The Outlook meeting</h2>
        <div className="mt-4 space-y-3">
          <Card title="When it is sent">
            The calendar invitation goes out once, when the meeting room accepts. The subject is the visit title, then
            the requester’s full name. The message has the date and the room. Accept adds it to the calendar. It does not
            wait for the driver, the gate pass, the gift, or a building-tour approval, and it is not sent again to people
            who already have it.
          </Card>
          <Card title="Who is on it">
            The requester, the invitation team, and the case contacts: Samir for a customer, Hannah and Salma for a
            supplier, and Hannah, Salma, and Jesman for any tour. The invitation team is listed on the visit card and on
            the meeting page.
          </Card>
          <Card title="Who is left off it">
            Every guest, and any address outside NEWEAST and AISIN. Sawsan’s information email is separate and is not a
            place on this meeting unless she is also on the invitation team.
          </Card>
          <Card title="A person returns">
            Removing a colleague needs a reason and takes the meeting off that person’s calendar. Putting the same person
            back places the meeting directly on their calendar, without Accept.
          </Card>
        </div>
      </section>

      <section id="security" className="mt-12">
        <h2 className="text-lg font-semibold">Before Security can see the visit</h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed">
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">A city hall is chosen: Berlin, Dubai, Riyadh, Shanghai, or Tokyo.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If a driver was requested, Sachini has confirmed it.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If a gate pass was requested, Muna has approved it and uploaded the file. The choice covers every guest.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If it is a building tour, Salma has approved it. A supplier visit and a ground-floor tour do not wait for approval.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">A gift never holds Security or the calendar invitation. While the visit is Preparing, Confirm stays hidden.</li>
        </ul>
      </section>

      <section id="change" className="mt-12">
        <h2 className="text-lg font-semibold">Change or cancel</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card title="Hall or time changes">
            Saving the same hall and the same time does not write to Outlook again. A real change of time updates the
            same room booking. People who already received the calendar invitation are not sent a second copy.
          </Card>
          <Card title="One colleague is cancelled">
            A reason is required. That person receives a cancellation, and the meeting leaves their calendar. The visit
            stays on for everyone else. If they are added again, the meeting is placed directly on their calendar.
          </Card>
          <Card title="The visit is cancelled">
            A reason is required. The room booking is released. The invited company people receive an email that the
            visit was cancelled, including the reason.
          </Card>
        </div>
      </section>

      <p className="mt-12 border-t border-[var(--line)] pt-6 text-[12px] leading-relaxed text-[var(--muted)]">
        Guest Management · {SHARE}
      </p>
      </GuideExplorer>
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
