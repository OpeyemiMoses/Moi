'use client';

import React from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Wallet, AlertTriangle } from 'lucide-react';

interface MoiWalletButtonProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MoiWalletButton({ className = '', size = 'md' }: MoiWalletButtonProps) {
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-1 text-[11px]'
      : size === 'lg'
      ? 'px-4 py-2.5 text-xs'
      : 'px-3 py-1.5 text-xs';

  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        mounted,
      }) => {
        const ready = mounted;
        const connected = ready && account && chain;

        return (
          <div
            {...(!ready && {
              'aria-hidden': true,
              style: {
                opacity: 0,
                pointerEvents: 'none',
                userSelect: 'none',
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] transition shadow-xs cursor-pointer ${sizeClasses} ${className}`}
                  >
                    <Wallet className="w-3.5 h-3.5 text-[#0B0F14]" />
                    <span>Connect Wallet</span>
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-xs cursor-pointer ${sizeClasses} ${className}`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Switch to Celo</span>
                  </button>
                );
              }

              return (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-full font-semibold bg-white hover:bg-[#F8FAFC] border border-[#0B0F14]/10 text-[#0B0F14] transition cursor-pointer px-2.5 py-1 text-[11px]`}
                  >
                    {chain.hasIcon && (
                      <div
                        style={{
                          background: chain.iconBackground,
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          overflow: 'hidden',
                          marginRight: 4,
                        }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? 'Chain icon'}
                            src={chain.iconUrl}
                            style={{ width: 14, height: 14 }}
                          />
                        )}
                      </div>
                    )}
                    <span>{chain.name}</span>
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className={`inline-flex items-center gap-1.5 rounded-full font-bold bg-[#B6F7D2]/60 hover:bg-[#B6F7D2] text-[#087F5B] border border-[#00E676]/30 font-mono-num transition cursor-pointer px-3 py-1 text-xs`}
                  >
                    <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
                    <span>{account.displayName}</span>
                    {account.displayBalance && (
                      <span className="text-[#0B0F14]/60 font-sans font-medium text-[11px]">
                        ({account.displayBalance})
                      </span>
                    )}
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

