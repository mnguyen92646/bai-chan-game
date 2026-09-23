import { notFound } from "next/navigation";
import { TablePreview } from "../board-preview/preview";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const params = await searchParams;
  return <TablePreview count={params.players === "5" ? 5 : 4} crowded={params.crowded === "1"} large={params.large === "1"} draw={params.draw === "1"} won={params.won === "1"} />;
}
