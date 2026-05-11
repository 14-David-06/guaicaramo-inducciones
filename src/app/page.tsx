import { LandingClient } from "@/components/landing/LandingClient";
import { RippleCursor } from "@/components/landing/RippleCursor";
import { RevealOnScroll } from "@/components/landing/RevealOnScroll";

export default function Home() {
  return (
    <>
      <RippleCursor />
      <RevealOnScroll />
      <LandingClient />
    </>
  );
}
