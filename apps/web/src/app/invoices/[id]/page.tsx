import { redirect } from 'next/navigation';

export default async function InvoicesPluralRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/invoice/${encodeURIComponent(id)}`);
}

