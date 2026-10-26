import Image from "next/image";

export function NeweastLogo({
  className = "",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/neweast-logo.png"
      alt="NEWEAST"
      width={720}
      height={126}
      className={`h-auto w-full ${className}`}
      priority={priority}
    />
  );
}
