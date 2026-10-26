export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover" as const,
  themeColor: "#ffffff",
};

export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 h-[100dvh] w-full overflow-hidden bg-white">{children}</div>;
}
