import type { Metadata } from "next";
import { ServiceUnavailable } from "@/components/service-unavailable";

export const metadata: Metadata = {
  title: "Service unavailable",
  robots: { index: false, follow: false },
};

export default function ServiceUnavailablePage() {
  return <ServiceUnavailable />;
}
