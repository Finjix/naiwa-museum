import MuseumClient from "@/components/museum/MuseumClient";
import { getPublishedContent } from "@/lib/content/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getPublishedContent();
  return <MuseumClient content={content} />;
}
