'use client';

import '@rainbow-me/rainbowkit/styles.css';
import React, { useState } from 'react';
import { getDefaultConfig, RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider, http } from 'wagmi';
import { celo } from 'wagmi/chains';
import { QueryClientProvider, QueryClient } from '@tanstack/react-query';

export const wagmiConfig = getDefaultConfig({
  appName: 'MOI Autonomous Treasury OS',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '04440c53904647e4695dee82c3f52586',
  chains: [celo],
  transports: {
    [celo.id]: http('https://forno.celo.org'),
  },
  ssr: true,
});

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={lightTheme({
            accentColor: '#00E676',
            accentColorForeground: '#0B0F14',
            borderRadius: 'large',
            fontStack: 'system',
          })}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

