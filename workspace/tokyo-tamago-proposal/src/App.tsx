import { ACCESS_KEY } from "./config";
import { CtaBar } from "./components/CtaBar";
import { Footer } from "./components/Footer";
import { Gate } from "./components/Gate";
import { Hero } from "./components/Hero";
import { Section1, Section2, Section3, Section4 } from "./components/sections/part1";
import { Section5, SectionDemo } from "./components/sections/part2";
import { Section10, Section6, Section7, Section8, Section9 } from "./components/sections/part3";
import { Section11 } from "./components/sections/nextSteps";

export default function App() {
  // 簡易閲覧制限：?key= が ACCESS_KEY と一致しない場合は本文を出さない
  const key = new URLSearchParams(window.location.search).get("key");
  if (key !== ACCESS_KEY) {
    return <Gate />;
  }

  return (
    <div className="min-h-screen bg-cream font-sans">
      <main className="mx-auto max-w-4xl px-4 md:px-8">
        <Hero />
        <Section1 />
        <Section2 />
        <Section3 />
        <Section4 />
        <Section5 />
        <SectionDemo />
        <Section6 />
        <Section7 />
        <Section8 />
        <Section9 />
        <Section10 />
        <Section11 />
        <Footer />
      </main>
      <CtaBar />
    </div>
  );
}
