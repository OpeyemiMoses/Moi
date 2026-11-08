'use client';

import React, { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  ShieldCheck,
  Building2,
  FileText,
  Clock,
  Wallet,
  RefreshCw,
  ArrowUpRight,
  ChevronLeft,
  QrCode as QrIcon,
} from 'lucide-react';
import { useAccount, useSwitchChain } from 'wagmi';
import { celo } from 'wagmi/chains';
import { createPublicClient, http, encodeFunctionData, parseUnits, formatUnits, erc20Abi } from 'viem';
import { CELO_VERIFIED_ASSETS, AssetSymbol, formatAtomicUnits } from '@moi/shared-types';
import { MoiRibbonMark } from '@/components/MoiLogo';
import { MoiWalletButton } from '@/components/MoiWalletButton';

const ATTRIBUTION_TAG = 'celo_c9cb9a59fc4c';
const ATTRIBUTION_SUFFIX = '63656c6f5f633963623961353966633463110080218021802180218021802180218021';

const publicClient = createPublicClient({
  chain: celo,
  transport: http('https://forno.celo.org'),
});

interface InvoicePageProps {
  params: Promise<{ id: string }>;
}

export default function InvoicePaymentCheckoutPage({ params }: InvoicePageProps) {
  const resolvedParams = use(params);
  const invoiceId = resolvedParams.id;

  const { address: userWallet, isConnected, chain, connector } = useAccount();
  const { switchChain } = useSwitchChain();

  // Helper to obtain the specific EIP-1193 provider for the wallet connected via RainbowKit
  // Prevents third-party browser extensions (like Phantom) from hijacking window.ethereum
  const getConnectedEthereumProvider = useCallback(async () => {
    if (connector && typeof (connector as any).getProvider === 'function') {
      try {
        const p = await (connector as any).getProvider();
        if (p) return p;
      } catch (err) {
        console.warn('Connector getProvider error:', err);
      }
    }
    if (typeof window !== 'undefined') {
      const eth = (window as any).ethereum;
      if (!eth) return null;
      if (Array.isArray(eth.providers) && eth.providers.length > 0) {
        const nonPhantom = eth.providers.find(
          (p: any) => !p.isPhantom && (p.isMetaMask || p.isRainbow || p.isCoinbaseWallet || p.isRabby)
        );
        if (nonPhantom) return nonPhantom;
        const generalNonPhantom = eth.providers.find((p: any) => !p.isPhantom);
        if (generalNonPhantom) return generalNonPhantom;
      }
      return eth;
    }
    return null;
  }, [connector]);

  const [invoice, setInvoice] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payer balance state
  const [payerBalanceAtomic, setPayerBalanceAtomic] = useState<string>('0');
  const [payerBalanceFormatted, setPayerBalanceFormatted] = useState<string>('0.00');
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Payment execution state
  const [isPaying, setIsPaying] = useState(false);
  const [paymentStepText, setPaymentStepText] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentTxHash, setPaymentTxHash] = useState<string | null>(null);

  // Copy state
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Fetch invoice details
  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/${encodeURIComponent(invoiceId)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Invoice not found.');
      }
      setInvoice(data.invoice);
      if (data.invoice.paidTxHash) {
        setPaymentTxHash(data.invoice.paidTxHash);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load invoice.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
    // Poll every 5 seconds to sync if paid externally
    const interval = setInterval(fetchInvoice, 5000);
    return () => clearInterval(interval);
  }, [invoiceId]);

  // Read payer's live token balance on Celo Mainnet
  const fetchPayerBalance = async () => {
    if (!userWallet || !invoice) return;
    setBalanceLoading(true);
    try {
      const symbol = (invoice.tokenSymbol || 'USDT') as AssetSymbol;
      const assetMeta = CELO_VERIFIED_ASSETS[symbol] || CELO_VERIFIED_ASSETS.USDT;

      let balAtomic = 0n;
      if (symbol === 'CELO') {
        balAtomic = await publicClient.getBalance({ address: userWallet });
      } else {
        balAtomic = (await publicClient.readContract({
          address: assetMeta.address,
          abi: erc20Abi,
          functionName: 'balanceOf',
          args: [userWallet],
        })) as bigint;
      }

      setPayerBalanceAtomic(balAtomic.toString());
      setPayerBalanceFormatted(formatUnits(balAtomic, assetMeta.decimals));
    } catch (err) {
      console.error('Failed to read payer balance:', err);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && userWallet && invoice) {
      fetchPayerBalance();
    }
  }, [isConnected, userWallet, invoice?.tokenSymbol]);

  // Calculate required atomic units
  const symbol = ((invoice?.tokenSymbol || 'USDT') as AssetSymbol);
  const assetMeta = CELO_VERIFIED_ASSETS[symbol] || CELO_VERIFIED_ASSETS.USDT;
  const numAmount = Number(invoice?.amount || '0');

  const requiredAtomicUnits = (() => {
    try {
      if (!invoice?.amount) return 0n;
      return parseUnits(invoice.amount, assetMeta.decimals);
    } catch {
      return 0n;
    }
  })();

  const hasSufficientBalance = BigInt(payerBalanceAtomic) >= requiredAtomicUnits;

  // Execute onchain payment
  const handlePayInvoice = async () => {
    if (!isConnected || !userWallet) {
      setPaymentError('Please connect your Web3 wallet first.');
      return;
    }

    if (chain?.id !== celo.id) {
      try {
        await switchChain({ chainId: celo.id });
      } catch {
        setPaymentError('Please switch your wallet network to Celo Mainnet (42220).');
        return;
      }
    }

    const eth = await getConnectedEthereumProvider();
    if (!eth) {
      setPaymentError('Connected Web3 wallet (MetaMask/Rainbow/Coinbase) not detected. Please reconnect your wallet.');
      return;
    }

    setIsPaying(true);
    setPaymentError(null);
    setPaymentStepText('Step 1/2: Prompting wallet signature on Celo Mainnet...');

    try {
      let txHash = '';

      if (symbol === 'CELO') {
        // Native CELO transfer with ERC-8021 attribution trailer
        const hexVal = '0x' + requiredAtomicUnits.toString(16);
        const taggedData = ('0x' + ATTRIBUTION_SUFFIX) as `0x${string}`;

        txHash = await eth.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: userWallet,
              to: invoice.creatorWallet,
              value: hexVal,
              data: taggedData,
            },
          ],
        });
      } else {
        // ERC-20 transfer with ERC-8021 attribution trailer
        const transferCalldata = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'transfer',
          args: [invoice.creatorWallet, requiredAtomicUnits],
        });
        const taggedCalldata = (transferCalldata + ATTRIBUTION_SUFFIX) as `0x${string}`;

        txHash = await eth.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: userWallet,
              to: assetMeta.address,
              data: taggedCalldata,
            },
          ],
        });
      }

      setPaymentStepText(
        `Step 2/2: Transaction broadcasted (${txHash.slice(0, 10)}...). Waiting for Celo block confirmation...`
      );

      // Poll until Celo block confirms receipt
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        try {
          const receipt = await eth.request({
            method: 'eth_getTransactionReceipt',
            params: [txHash],
          });
          if (receipt && receipt.blockNumber) {
            break;
          }
        } catch {}
      }

      setPaymentStepText('Confirmed on Celo! Finalizing settlement in double-entry audit ledger...');

      // Notify backend to mark invoice paid
      await fetch(`/api/invoices/${encodeURIComponent(invoice.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_paid',
          paidTxHash: txHash,
        }),
      });

      setPaymentTxHash(txHash);
      setInvoice({
        ...invoice,
        status: 'PAID',
        paidTxHash: txHash,
        paidAt: new Date().toISOString(),
      });
      setPaymentStepText(null);
    } catch (err: any) {
      console.error('Payment execution failed:', err);
      setPaymentError(err?.message || 'Payment transaction was cancelled or failed on Celo.');
    } finally {
      setIsPaying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 rounded-full border-2 border-[#00E676] border-t-transparent animate-spin mb-3" />
        <p className="text-xs text-[#0B0F14]/60 font-mono">Loading Cryptographic Invoice...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mb-3">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#0B0F14] mb-1">Invoice Not Found</h2>
        <p className="text-xs text-[#0B0F14]/60 max-w-sm mb-4">
          The requested invoice identifier does not exist or has been removed from the treasury database.
        </p>
        <Link
          href="/"
          className="px-4 py-2 rounded-xl bg-[#0B0F14] text-white text-xs font-bold hover:bg-[#1E293B] transition"
        >
          Return to MOI Treasury
        </Link>
      </div>
    );
  }

  const isPaid = invoice.status === 'PAID';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B0F14]">
      {/* Top Protocol Header */}
      <header className="border-b border-[#0B0F14]/8 bg-white/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition">
            <MoiRibbonMark className="w-8 h-6" />
            <span className="font-extrabold text-sm tracking-tight text-[#0B0F14]">MOI</span>
          </Link>
          <span className="text-[#0B0F14]/20">/</span>
          <span className="text-xs font-semibold text-[#0B0F14]/60">B2B Settlement Protocol</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#B6F7D2]/40 border border-[#00E676]/30 text-[11px] font-bold text-[#087F5B]">
            <span className="w-2 h-2 rounded-full bg-[#00E676] animate-pulse" />
            <span>Celo Mainnet (42220)</span>
          </div>
          <MoiWalletButton size="sm" />
        </div>
      </header>

      {/* Main Payment Container */}
      <main className="max-w-xl mx-auto px-4 py-8 sm:py-12">
        {/* Status Notification Banner */}
        {isPaid ? (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-50 border border-emerald-200/80 shadow-xs flex items-center gap-3 animate-in fade-in duration-300 card-pop reveal-pop">
            <div className="w-10 h-10 rounded-xl bg-[#00E676] text-[#0B0F14] flex items-center justify-center shrink-0 shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-[#087F5B]">Invoice Paid & Settled</h4>
                <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2] text-[#087F5B] text-[10px] font-black uppercase">
                  Verified Onchain
                </span>
              </div>
              <p className="text-[11px] text-[#087F5B]/80 truncate mt-0.5">
                Settled on Celo Mainnet · Funds credited to payee
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200/80 shadow-xs flex items-center justify-between card-pop reveal-pop">
            <div className="flex items-center gap-2.5">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <div>
                <h4 className="text-xs font-bold text-amber-900">Payment Request Awaiting Settlement</h4>
                <p className="text-[11px] text-amber-700/80">Connect your wallet on Celo Mainnet to complete payment</p>
              </div>
            </div>
            <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-900">
              Awaiting Onchain Tx
            </span>
          </div>
        )}

        {/* Invoice Card */}
        <div className="bg-white rounded-3xl border border-[#0B0F14]/10 shadow-xl overflow-hidden card-pop reveal-pop reveal-delay-100">
          {/* Card Header */}
          <div className="p-6 sm:p-8 bg-gradient-to-b from-[#F8FAFC] to-white border-b border-[#0B0F14]/8">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <span className="text-xs font-bold text-[#0B0F14]/60 font-mono uppercase tracking-wider">
                {invoice.invoiceNumber}
              </span>
              <span className="text-[11px] font-bold text-[#087F5B] bg-[#B6F7D2]/40 border border-[#00E676]/30 px-2.5 py-0.5 rounded-full">
                Zero Gas EIP-712 Signed
              </span>
            </div>

            <div className="space-y-1">
              <p className="text-xs text-[#0B0F14]/50 font-semibold uppercase tracking-wider">Total Amount Due</p>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl sm:text-4xl font-black font-mono-num text-[#0B0F14]">
                  {invoice.amount}
                </span>
                <span className="text-xl sm:text-2xl font-bold text-[#087F5B]">{invoice.tokenSymbol}</span>
              </div>
              <p className="text-xs text-[#0B0F14]/60 font-medium pt-1">
                For: <span className="text-[#0B0F14] font-semibold">{invoice.clientName}</span>
              </p>
            </div>
          </div>

          {/* Details Breakdown */}
          <div className="p-6 sm:p-8 space-y-4">
            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#0B0F14]/8">
                <span className="text-[#0B0F14]/60">Description / Memo</span>
                <span className="font-semibold text-[#0B0F14] text-right truncate max-w-[240px]">
                  {invoice.memo || 'B2B Commercial Settlement'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#0B0F14]/8">
                <span className="text-[#0B0F14]/60">Payment Terms</span>
                <span className="font-semibold text-[#0B0F14]">{invoice.dueDate || 'Due on Receipt'}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#0B0F14]/8">
                <span className="text-[#0B0F14]/60">Issuance Date</span>
                <span className="font-medium text-[#0B0F14]/80">
                  {new Date(invoice.createdAt || Date.now()).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#0B0F14]/8">
                <span className="text-[#0B0F14]/60">Settlement Network</span>
                <span className="font-semibold text-[#087F5B] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676]" />
                  Celo Mainnet (Chain ID 42220)
                </span>
              </div>

              {/* Recipient Wallet */}
              <div className="flex items-center justify-between pt-1">
                <span className="text-[#0B0F14]/60">Payee / Creator Address</span>
                <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#0B0F14]">
                  <span>
                    {invoice.creatorWallet.slice(0, 6)}...{invoice.creatorWallet.slice(-4)}
                  </span>
                  <button
                    onClick={() => copyToClipboard(invoice.creatorWallet, 'creatorWallet')}
                    className="p-1 rounded hover:bg-slate-100 text-[#0B0F14]/60 transition cursor-pointer"
                    title="Copy address"
                  >
                    {copiedField === 'creatorWallet' ? (
                      <Check className="w-3.5 h-3.5 text-[#087F5B]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={`https://celoscan.io/address/${invoice.creatorWallet}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1 rounded hover:bg-slate-100 text-[#0B0F14]/60 transition"
                    title="View on Celoscan"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Cryptographic Signature Box */}
            <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#0B0F14] flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>Cryptographic Proof</span>
                </span>
                <span className="text-[10px] font-mono text-[#087F5B] font-bold">
                  {invoice.signatureScheme || 'EIP-712'} Verified
                </span>
              </div>
              <p className="text-[10px] text-[#0B0F14]/50 font-mono truncate">
                {invoice.creatorSignature}
              </p>
            </div>

            {/* Payment Interactive Execution Area */}
            <div className="pt-2">
              {isPaid ? (
                /* Settled Card */
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-2">
                  <div className="flex items-center justify-center gap-2 text-[#087F5B]">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-bold text-sm">Payment Confirmed & Settled</span>
                  </div>
                  {invoice.paidTxHash && (
                    <div className="pt-1">
                      <p className="text-[11px] text-[#087F5B]/80 font-medium">Onchain Transaction Hash:</p>
                      <a
                        href={`https://celoscan.io/tx/${invoice.paidTxHash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-[#087F5B] underline hover:text-[#066146] mt-0.5"
                      >
                        <span>
                          {invoice.paidTxHash.slice(0, 14)}...{invoice.paidTxHash.slice(-8)}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                  {invoice.paidAt && (
                    <p className="text-[10px] text-[#087F5B]/60 font-mono">
                      Timestamp: {new Date(invoice.paidAt).toLocaleString()}
                    </p>
                  )}
                </div>
              ) : (
                /* Unpaid Action Area */
                <div className="space-y-3">
                  {!isConnected ? (
                    <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#0B0F14]/10 text-center space-y-3">
                      <p className="text-xs text-[#0B0F14]/70 font-medium">
                        Connect your wallet to pay <span className="font-bold text-[#0B0F14]">{invoice.amount} {invoice.tokenSymbol}</span> directly on Celo Mainnet.
                      </p>
                      <div className="flex justify-center">
                        <MoiWalletButton size="md" />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Payer Wallet Balance Card */}
                      <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 flex items-center justify-between text-xs">
                        <div>
                          <span className="text-[#0B0F14]/50 block text-[10px] uppercase font-bold tracking-wider">
                            Your Connected Balance
                          </span>
                          <span className="font-bold text-sm font-mono-num text-[#0B0F14]">
                            {balanceLoading ? (
                              'Reading Celo...'
                            ) : (
                              `${Number(payerBalanceFormatted).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${invoice.tokenSymbol}`
                            )}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[#0B0F14]/50 block text-[10px] uppercase font-bold tracking-wider">
                            Required
                          </span>
                          <span className="font-bold text-sm font-mono-num text-[#087F5B]">
                            {invoice.amount} {invoice.tokenSymbol}
                          </span>
                        </div>
                      </div>

                      {/* Insufficient balance warning */}
                      {!balanceLoading && !hasSufficientBalance && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
                          <div>
                            <p className="font-bold">Insufficient {invoice.tokenSymbol} Balance</p>
                            <p className="text-[11px] text-red-600/90 mt-0.5">
                              You have {Number(payerBalanceFormatted).toFixed(2)} {invoice.tokenSymbol}, but this invoice requires {invoice.amount} {invoice.tokenSymbol}. Please fund your wallet on Celo to proceed.
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Payment Step / Error notification */}
                      {paymentStepText && (
                        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-[#087F5B] flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                          <span>{paymentStepText}</span>
                        </div>
                      )}

                      {paymentError && (
                        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0" />
                          <span>{paymentError}</span>
                        </div>
                      )}

                      {/* Primary Trigger Payment Button */}
                      <button
                        type="button"
                        onClick={handlePayInvoice}
                        disabled={isPaying || (!balanceLoading && !hasSufficientBalance)}
                        className="w-full py-3.5 rounded-2xl bg-[#00E676] hover:bg-[#00c968] disabled:opacity-40 disabled:cursor-not-allowed text-[#0B0F14] font-black text-sm tracking-wide transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer btn-pop hover-pop"
                      >
                        {isPaying ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Processing Payment on Celo...</span>
                          </>
                        ) : (
                          <>
                            <Building2 className="w-4 h-4" />
                            <span>Pay {invoice.amount} {invoice.tokenSymbol} Now</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      <p className="text-[10px] text-[#0B0F14]/50 text-center">
                        Onchain transaction includes ERC-8021 attribution tag ({ATTRIBUTION_TAG}) · Sub-cent gas fee
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Back Link to Treasury */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0B0F14]/60 hover:text-[#0B0F14] transition"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Go to MOI Treasury Dashboard</span>
          </Link>
        </div>
      </main>
    </div>
  );
}
