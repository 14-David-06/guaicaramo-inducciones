import { SessionKeepAlive } from "@/components/SessionKeepAlive";

export default function ModulosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SessionKeepAlive />
      {children}
    </>
  );
}
