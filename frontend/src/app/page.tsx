import AppClient from "@/components/AppClient";
import { JsonLd } from "@/components/JsonLd";

export default function Home() {
  return (
    <>
      <JsonLd />
      <AppClient />
    </>
  );
}
