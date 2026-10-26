import { NeweastLogo } from "@/components/logo";
import { ErrorText } from "@/components/ui";
import { APP_NAME } from "@/lib/constants";
import { intranetUrl } from "@/lib/notice-copy";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const query = await searchParams;

  return (
    <div className="flex min-h-full items-center justify-center bg-[radial-gradient(900px_420px_at_0%_-10%,#f6e4e4,transparent_55%),radial-gradient(720px_360px_at_100%_0%,#eef2f8,transparent_50%),#f7f4f4] px-4 py-10">
      <div className="w-full max-w-[440px]">
        <div className="mb-8">
          <NeweastLogo className="w-[220px]" priority />
          <div className="mt-4 text-[11px] font-medium tracking-[0.18em] text-[var(--brand)]">HEADQUARTERS</div>
          <h1 className="mt-1 text-[28px] font-medium tracking-tight">{APP_NAME}</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Open Guest Management from the NEWEAST Intranet. Password sign-in is closed.
          </p>
        </div>
        <div className="rounded-2xl border border-[#ead8d8] bg-[var(--tint-mint)] p-5 shadow-[0_1px_0_rgba(20,32,31,0.03)]">
          <ErrorText error={query.error} />
          <p className="text-sm text-[var(--ink)]">
            Use the Guest Management link on the intranet. You will come back here already signed in.
          </p>
          <a
            href={intranetUrl()}
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-lg bg-[var(--brand)] text-[13px] font-medium text-white"
          >
            Open intranet
          </a>
        </div>
      </div>
    </div>
  );
}
