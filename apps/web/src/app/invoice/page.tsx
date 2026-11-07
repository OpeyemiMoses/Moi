import { redirect } from 'next/navigation';

export default async function InvoiceQueryRedirect({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  if (id) {
    redirect(`/invoice/${encodeURIComponent(id)}`);
  }
  redirect('/?tab=invoices');
}
