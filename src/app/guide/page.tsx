import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guest visit process · NEWEAST",
  description: "How a NEWEAST headquarters guest visit moves from the request to the Outlook invitation.",
};

const SHARE = "https://guest.neweast.cloud/guide";

export default function GuidePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand)]">NEWEAST Headquarters</p>
      <h1 className="mt-2 text-[32px] font-semibold leading-tight tracking-tight">Guest visit process</h1>
      <p className="mt-2 text-[15px] text-[var(--muted)]">مسار الزيارة من الطلب حتى دعوة Outlook. شاركوا هذا الرابط.</p>
      <p className="mt-4 text-[15px] leading-relaxed">
        An employee sends a visit request. Reception assigns the room if needed, the room confirms, and only then the
        Outlook invitation goes to company people. A building tour waits for Salma before that invitation is sent.
      </p>
      <p className="mt-3 text-[13px] text-[var(--muted)]">
        Share:{" "}
        <a className="font-medium text-[var(--brand-ink)]" href={SHARE}>
          {SHARE}
        </a>
      </p>

      <nav className="mt-8 flex flex-wrap gap-2 text-[12px]">
        {[
          ["#path", "Main path"],
          ["#request", "The request"],
          ["#cases", "Each case"],
          ["#outlook", "Outlook"],
          ["#security", "Security"],
          ["#change", "Change or cancel"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-[var(--ink)]">
            {label}
          </a>
        ))}
      </nav>

      <section id="path" className="mt-10">
        <h2 className="text-lg font-semibold">Main path</h2>
        <ol className="mt-4 space-y-3">
          <Step n="1" title="Employee sends the request" body="Visit request. Phone, email, and documents are optional. The room can be a hall or N/A." />
          <Step n="2" title="Reception receives it" body="The request is with Reception at once. Driver, gate pass, gift, and tour notices go out at the same time when they were selected." />
          <Step n="3" title="Reception books the hall" body="If the requester chose N/A, Reception picks a free ground-floor room. Outlook asks that room to accept. People are not invited yet." />
          <Step n="4" title="The room confirms" body="The Outlook invitation and the confirmation email go to company people only. A building tour waits for Salma first. Guests are not invited." />
          <Step n="5" title="Reception sends it to Security" body="Security sees the visit after the room is set and any required driver, gate pass, or building-tour approval is done." />
        </ol>
      </section>

      <section id="request" className="mt-12">
        <h2 className="text-lg font-semibold">What the requester fills in</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card title="Required">
            <ul className="list-disc space-y-1 pl-4">
              <li>Visit date and arrival time</li>
              <li>Department</li>
              <li>Guest type: Guest, Customer, Supplier, or VIP</li>
              <li>Purpose</li>
              <li>Each guest’s full name</li>
            </ul>
          </Card>
          <Card title="Optional">
            <ul className="list-disc space-y-1 pl-4">
              <li>Mobile and email. The request is accepted without them.</li>
              <li>Company, job title, nationality</li>
              <li>ID, Passport, and Visa files. Any of the three, or none.</li>
              <li>Colleagues to invite</li>
            </ul>
          </Card>
        </div>
        <Card title="Room" className="mt-3">
          The requester can choose a ground-floor city room, or <strong>N/A</strong>. N/A means Reception chooses the
          hall. A room the requester picks is a proposal. Reception can still change it. Booked rooms cannot be selected.
        </Card>
        <Card title="Reception can also start the visit" className="mt-3">
          Visitor Book on Meeting rooms creates the visit and books the hall immediately. There is no extra approval
          step for that. Phone, email, and the three documents stay optional there too.
        </Card>
      </section>

      <section id="cases" className="mt-12">
        <h2 className="text-lg font-semibold">What happens in each case</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--muted)]">
          These run as soon as the request is sent. They do not replace the room booking.
        </p>
        <div className="mt-4 space-y-3">
          <Case
            title="Guest or VIP, no tour"
            when="Nothing extra is selected"
            result="Reception books the room. When the room confirms, the invitation goes to the requester and invited colleagues. Guests do not receive the meeting."
          />
          <Case
            title="Customer"
            when="Guest type is Customer"
            result="Same room path. When the room confirms, Samir Ibrahim receives the Outlook meeting plus an email and a Teams message with the full visit details. Samir does not have to approve it."
          />
          <Case
            title="Supplier"
            when="Guest type is Supplier"
            result="Hannah Talastas and Salma Moufallah are notified by email and Teams with the full visit details. Neither approval is required. The visit, the room, and Outlook are not held. When the room confirms, both also receive the Outlook meeting."
          />
          <Case
            title="Ground-floor tour"
            when="Tour is GF Tour"
            result="Hannah Talastas and Salma Moufallah are notified when the request is sent. This notice does not hold the visit. After the room confirms, Hannah, Salma, and Jesman Muruganantham receive the Outlook meeting, plus email and Teams with the details."
          />
          <Case
            title="Building tour"
            when="Tour is Building Tour"
            result="Salma Moufallah receives an approval request by email and Teams. Hannah Talastas is notified. The visit and the Outlook invitation wait until Salma approves. If Salma is the requester, the tour is approved with the request and Hannah is still notified. After the room confirms, Hannah, Salma, and Jesman Muruganantham receive the Outlook meeting."
          />
          <Case
            title="Driver and car"
            when="Driver is Yes"
            result="Sachini receives the driver request. She confirms it. Reception cannot confirm the visit or send it to Security until Sachini has confirmed the driver."
          />
          <Case
            title="Gate pass"
            when="Gate pass is Yes"
            result="Muna at Reception approves the pass, then uploads the file when it is ready. The visit cannot go to Security until that file is uploaded."
          />
          <Case
            title="Protocol gift"
            when="Gift is Yes"
            result="Jesman receives the gift request and prepares it. That is separate from a tour. The gift does not hold the room or the visit confirmation."
          />
        </div>
      </section>

      <section id="outlook" className="mt-12">
        <h2 className="text-lg font-semibold">Who receives the Outlook invitation</h2>
        <p className="mt-2 text-[14px] leading-relaxed">
          The invitation is sent once the hall has accepted. It stays inside the company. Guests are not on the meeting, even when they have an email.
        </p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--line)] bg-white">
          <table className="w-full text-left text-[13px]">
            <thead className="bg-[var(--tint-mint)] text-[11px] uppercase tracking-[0.08em] text-[var(--faint)]">
              <tr>
                <th className="px-4 py-3 font-medium">Person</th>
                <th className="px-4 py-3 font-medium">What they get</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              <Row who="Requester" what="Outlook meeting on their company calendar, plus a confirmation email." />
              <Row who="Invited colleagues" what="The same Outlook meeting and confirmation email." />
              <Row who="Guests" what="Nothing. They are not invited, and they do not get a change or cancellation email." />
              <Row who="Customer visit" what="Samir Ibrahim also receives the Outlook meeting, plus email and Teams with the full details." />
              <Row who="Supplier visit" what="Hannah Talastas and Salma Moufallah also receive the Outlook meeting, plus email and Teams with the full details. No approval." />
              <Row who="Any tour" what="Hannah Talastas, Salma Moufallah, and Jesman Muruganantham also receive the Outlook meeting. A building tour waits for Salma’s approval first." />
            </tbody>
          </table>
        </div>
        <Card title="Who already has the meeting" className="mt-3">
          Reception, who booked the hall, already has the meeting because they are the organizer. A guest is never added later.
        </Card>
      </section>

      <section id="security" className="mt-12">
        <h2 className="text-lg font-semibold">Before Security can see the visit</h2>
        <ul className="mt-4 space-y-2 text-[14px] leading-relaxed">
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">A meeting room is chosen.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If a driver was requested, Sachini has confirmed it.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If a gate pass was requested, Muna has approved it and uploaded the file.</li>
          <li className="rounded-xl border border-[var(--line)] bg-white px-4 py-3">If it is a building tour, Salma Moufallah has approved it. A supplier visit does not wait for approval.</li>
        </ul>
      </section>

      <section id="change" className="mt-12">
        <h2 className="text-lg font-semibold">Change or cancel</h2>
        <div className="mt-4 space-y-3">
          <Card title="Room or time changes">
            The requester, invited colleagues, and the case contacts on the meeting receive an email that it was updated, with the new room and time. Their Outlook meeting is updated. Guests are not emailed.
          </Card>
          <Card title="The visit or the booking is cancelled">
            The Outlook event is removed. The same company people receive an email that it was cancelled, including the reason. Guests are not emailed. A cancellation reason is required.
          </Card>
        </div>
      </section>

      <p className="mt-12 border-t border-[var(--line)] pt-6 text-[12px] leading-relaxed text-[var(--muted)]">
        Guest Management · {SHARE}
      </p>
    </main>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="flex gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand)] text-[12px] font-semibold text-white">
        {n}
      </span>
      <div>
        <div className="text-[14px] font-semibold">{title}</div>
        <p className="mt-1 text-[13px] leading-relaxed text-[var(--muted)]">{body}</p>
      </div>
    </li>
  );
}

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[var(--line)] bg-white p-4 ${className}`}>
      <div className="text-[13px] font-semibold">{title}</div>
      <div className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{children}</div>
    </div>
  );
}

function Case({ title, when, result }: { title: string; when: string; result: string }) {
  return (
    <article className="rounded-2xl border border-[var(--line)] bg-white p-4">
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="mt-1 text-[12px] font-medium text-[var(--brand-ink)]">{when}</p>
      <p className="mt-2 text-[13px] leading-relaxed text-[var(--muted)]">{result}</p>
    </article>
  );
}

function Row({ who, what }: { who: string; what: string }) {
  return (
    <tr>
      <td className="px-4 py-3 align-top font-medium">{who}</td>
      <td className="px-4 py-3 align-top text-[var(--muted)]">{what}</td>
    </tr>
  );
}
