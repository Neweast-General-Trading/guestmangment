import Link from "next/link";
import { type ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  className = "",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div>
        <h1 className="page-title">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-[var(--muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const CARD_TONE = {
  plain: "border-[var(--line)] bg-white",
  mint: "border-[#ead8d8] bg-[var(--tint-mint)]",
  sky: "border-[#d6e2ee] bg-[var(--tint-sky)]",
  sand: "border-[#ebe3cf] bg-[var(--tint-sand)]",
  peach: "border-[#eadcd7] bg-[var(--tint-peach)]",
  lilac: "border-[#e2dcec] bg-[var(--tint-lilac)]",
  sage: "border-[#d7e6da] bg-[var(--tint-sage)]",
};

export function Card({
  children,
  className = "",
  padded = true,
  tone = "plain",
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
  tone?: keyof typeof CARD_TONE;
}) {
  return (
    <div className={`rounded-2xl border shadow-[0_1px_0_rgba(20,32,31,0.03)] ${CARD_TONE[tone]} ${padded ? "p-4" : ""} ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  children,
  href,
  variant = "primary",
  type = "button",
  className = "",
  formAction,
  disabled,
}: {
  children: ReactNode;
  href?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  type?: "button" | "submit";
  className?: string;
  formAction?: React.ComponentProps<"button">["formAction"];
  disabled?: boolean;
}) {
  const styles = {
    primary: "border border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand-ink)] hover:bg-[#f3dede]",
    secondary: "border border-[var(--line)] bg-white text-[var(--ink)] hover:bg-[#faf7f7]",
    ghost: "border border-transparent text-[var(--muted)] hover:bg-[#f7f2f2] hover:text-[var(--ink)]",
    danger: "border border-[#e4c4c2] bg-[#faf1f0] text-[#b14a42] hover:bg-[#f6e4e2]",
  }[variant];
  const cls = `inline-flex h-8 items-center justify-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles} ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return (
    <button type={type} className={cls} formAction={formAction} disabled={disabled}>
      {children}
    </button>
  );
}

export function Field({
  label,
  name,
  children,
  required,
}: {
  label: string;
  name?: string;
  children?: ReactNode;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-medium text-[var(--muted)]">
        {label}
        {required ? <span className="ml-0.5 text-[#b42318]">*</span> : null}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  "h-9 w-full rounded-lg border border-[var(--line)] bg-white px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--brand)]";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`min-h-24 w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-[13px] outline-none focus:border-[#9aa3b2] ${props.className ?? ""}`}
    />
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-4 py-14 text-center">
      <p className="text-sm font-medium">{title}</p>
      {hint ? <p className="mt-1 text-sm text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}

export function ErrorText({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p className="rounded-lg border border-[#f0c9c6] bg-[#fdecea] px-3 py-2 text-[13px] text-[#b42318]">{error}</p>
  );
}
