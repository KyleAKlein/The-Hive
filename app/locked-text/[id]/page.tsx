import LockedTextBuyer from "@/components/locked-text-buyer";

export default async function LockedTextPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LockedTextBuyer id={id} />;
}
