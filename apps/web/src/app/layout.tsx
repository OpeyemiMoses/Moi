import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MOI — Your AI Agent. Your Treasury. | Autonomous Treasury OS on Celo',
  description:
    'Control, transact and earn with identifiable AI agents on open payment rails. Built on Celo Mainnet with Textile FX v2, Ripio wFIAT, buy/x402, ERC-8004 identity, and ERC-8021 attribution.',
  icons: {
    icon: '/moi-logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#F8FAFC] text-[#0B0F14] antialiased">
        {children}
      </body>
    </html>
  );
}

