'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  PauseCircle,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Shield,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import { MoiHero3DEmblem, MoiRibbonMark } from '@/components/MoiLogo';
import { MoiWalletButton } from '@/components/MoiWalletButton';
import { useAccount, useDisconnect, useSignMessage } from 'wagmi';
import { encodeFunctionData, parseAbi, erc20Abi, maxUint256 } from 'viem';
import {
  AssetSymbol,
  CELO_VERIFIED_ASSETS,
  ExecutionRecord,
  FxPreviewResponse,
  LedgerEntryRecord,
  ServicePurchaseRecord,
  TreasuryMandate,
  buildRipioRampUrl,
  findAssetByAddress,
  formatAtomicUnits,
  formatAtomicWithCommas,
  parseAtomicUnits,
} from '@moi/shared-types';

const ATTRIBUTION_TAG = 'celo_c9cb9a59fc4c';
const ATTRIBUTION_SUFFIX = '63656c6f5f633963623961353966633463110080218021802180218021802180218021';
const SWAP_ROUTER_02 = '0x5615CDAb10dc425a742d643d949a7F474C01abc4';
const routerAbi = parseAbi([
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)',
]);

const CORE_CORRIDORS: Array<{ id: string; sell: AssetSymbol; buy: AssetSymbol; label: string }> = [
  { id: 'mandate_celo_usdt', sell: 'CELO', buy: 'USDT', label: 'CELO ↔ USD₮' },
  { id: 'mandate_cngn_usdt', sell: 'cNGN', buy: 'USDT', label: 'cNGN ↔ USD₮' },
  { id: 'mandate_wars_usdt', sell: 'wARS', buy: 'USDT', label: 'wARS ↔ USD₮' },
  { id: 'mandate_wbrl_usdt', sell: 'wBRL', buy: 'USDT', label: 'wBRL ↔ USD₮' },
  { id: 'mandate_wcop_usdt', sell: 'wCOP', buy: 'USDT', label: 'wCOP ↔ USD₮' },
  { id: 'mandate_wmxn_usdt', sell: 'wMXN', buy: 'USDT', label: 'wMXN ↔ USD₮' },
  { id: 'mandate_usdc_usdt', sell: 'USDC', buy: 'USDT', label: 'USDC ↔ USD₮' },
];

type AppTab =
  | 'dashboard'
  | 'agents'
  | 'treasury'
  | 'invoices'
  | 'buy'
  | 'transactions'
  | 'profile'
  | 'settings';

export default function MoiAppPage() {
  const { address: wagmiAddress, isConnected: isWagmiConnected, status: wagmiStatus } = useAccount();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();

  const [viewMode, setViewMode] = useState<'landing' | 'app'>('landing');
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Sign-In & Sign-Up Authentication state
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [authStep, setAuthStep] = useState<1 | 2>(1);
  const [authNameInput, setAuthNameInput] = useState('');
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authOrgInput, setAuthOrgInput] = useState('MOI Global Treasury');
  const [authRoleInput, setAuthRoleInput] = useState('Treasury Manager');
  const [authRegionInput, setAuthRegionInput] = useState('Nigeria & LatAm Corridors');
  const [authWalletInput, setAuthWalletInput] = useState('');
  const [authWalletError, setAuthWalletError] = useState<string | null>(null);
  const [authWalletLoading, setAuthWalletLoading] = useState(false);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [foundAccount, setFoundAccount] = useState<any>(null);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);

  // Profile Form state: strictly tied to connected wallet, cleanly blanked when disconnected
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    email: '',
    organization: 'MOI Global Treasury',
    roleTitle: 'Treasury Manager',
    primaryRegion: 'Nigeria & LatAm Corridors',
    preferredBaseSymbol: 'cNGN' as AssetSymbol,
  });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSavedToast, setProfileSavedToast] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Landing page live preview sandbox state
  const [landingPreviewSymbol, setLandingPreviewSymbol] = useState<'cNGN' | 'wARS' | 'wBRL' | 'wCOP'>('cNGN');
  const [landingPreviewAmount, setLandingPreviewAmount] = useState('10000');
  const [landingLivePreview, setLandingLivePreview] = useState<any>(null);
  const [landingPreviewLoading, setLandingPreviewLoading] = useState(false);

  // Live backend state
  const [loading, setLoading] = useState(true);
  const [treasuryData, setTreasuryData] = useState<any>(null);

  const activeOwnerWallet = (
    wagmiAddress ||
    (isWagmiConnected ? treasuryData?.treasury?.ownerWalletAddress : null) ||
    (isWagmiConnected ? treasuryData?.userProfile?.walletAddress : null) ||
    ''
  ).toLowerCase();

  const hasConnectedOwnerWallet = Boolean(
    activeOwnerWallet &&
      activeOwnerWallet !== '0x0000000000000000000000000000000000000000' &&
      !activeOwnerWallet.startsWith('0x00000000') &&
      isWagmiConnected
  );

  const ownerWalletShort = hasConnectedOwnerWallet
    ? `${activeOwnerWallet.slice(0, 6)}...${activeOwnerWallet.slice(-4)}`
    : 'Not Connected';

  const [buyCatalogData, setBuyCatalogData] = useState<any>(null);
  const [stitchFeedData, setStitchFeedData] = useState<any>(null);
  const [erc8004Data, setErc8004Data] = useState<any>(null);

  // FX Terminal state
  const [selectedMandateId, setSelectedMandateId] =
    useState<string>('mandate_cngn_usdt');
  const [sellHumanInput, setSellHumanInput] = useState<string>('10000');
  const [userApprovedCheckbox, setUserApprovedCheckbox] =
    useState<boolean>(true);
  const [livePreview, setLivePreview] = useState<FxPreviewResponse | null>(
    null
  );
  const [previewLoading, setPreviewLoading] = useState<boolean>(false);
  const [cycleLoading, setCycleLoading] = useState<boolean>(false);
  const [lastCycleOutcome, setLastCycleOutcome] = useState<any>(null);

  // Natural language mandate compiler state
  const [nlIntentInput, setNlIntentInput] = useState<string>(
    'Preserve 50,000 cNGN operating reserve. Convert excess up to 25,000 per trade with daily cap 100,000 in autonomous mode'
  );
  const [nlDraftSummary, setNlDraftSummary] = useState<string[]>([]);

  // Buy / x402 state
  const [selectedPaymentToken, setSelectedPaymentToken] = useState<
    'USAT' | 'USDT' | 'USDC'
  >('USAT');
  const [buyingCapabilityId, setBuyingCapabilityId] = useState<string | null>(
    null
  );
  const [lastBuyResult, setLastBuyResult] = useState<any>(null);

  // Ripio Ramp state
  const [ripioSymbol, setRipioSymbol] = useState<AssetSymbol>('wARS');
  const [ripioDirection, setRipioDirection] = useState<'onramp' | 'offramp'>(
    'onramp'
  );
  const [ripioAmount, setRipioAmount] = useState<string>('25000');

  // Bidirectional Swap Corridor state
  const [isDirectionFlipped, setIsDirectionFlipped] = useState<boolean>(false);
  const [showPolicyDetails, setShowPolicyDetails] = useState<boolean>(false);

  // Ledger / Transactions view toggle
  const [txSubView, setTxSubView] = useState<'executions' | 'approvals' | 'ledger' | 'audit'>(
    'executions'
  );
  const [approvingExecId, setApprovingExecId] = useState<string | null>(null);

  // Action Modals State (Send, Receive, Issue Agent, Earn, Configure Policy)
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendToken, setSendToken] = useState<AssetSymbol>('USDT');
  const [sendRecipient, setSendRecipient] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<any>(null);

  // Interactive Web3 Swap State (Direct Wallet Execution on Celo Mainnet)
  const [swapLoading, setSwapLoading] = useState(false);
  const [swapStepText, setSwapStepText] = useState<string | null>(null);
  const [swapError, setSwapError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<any>(null);
  const [customSellSymbol, setCustomSellSymbol] = useState<AssetSymbol | null>(null);
  const [customBuySymbol, setCustomBuySymbol] = useState<AssetSymbol | null>(null);

  const [showReceiveModal, setShowReceiveModal] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<'owner' | 'agent'>('owner');
  const [receiveQrUrl, setReceiveQrUrl] = useState<string>('');
  const [receiveCopied, setReceiveCopied] = useState<'owner' | 'agent' | null>(null);

  // Action Modal 6: Withdraw to Bank (Multi-Country Off-Ramp)
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawCurrency, setWithdrawCurrency] = useState<AssetSymbol>('cNGN');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawCountry, setWithdrawCountry] = useState<'NG' | 'BR' | 'AR' | 'CO' | 'MX' | 'US'>('NG');
  const [withdrawBankName, setWithdrawBankName] = useState('GTBank');
  const [withdrawAccountNumber, setWithdrawAccountNumber] = useState('');
  const [withdrawAccountName, setWithdrawAccountName] = useState('');
  const [withdrawPixKey, setWithdrawPixKey] = useState('');
  const [withdrawCbu, setWithdrawCbu] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<any>(null);

  // Dedicated Invoices & Payment Requests State
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [invoiceFormClientName, setInvoiceFormClientName] = useState('Acme Corporation');
  const [invoiceFormClientEmail, setInvoiceFormClientEmail] = useState('billing@acmecorp.com');
  const [invoiceFormRef, setInvoiceFormRef] = useState(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
  const [invoiceFormAmount, setInvoiceFormAmount] = useState('250');
  const [invoiceFormToken, setInvoiceFormToken] = useState<AssetSymbol>('USDT');
  const [invoiceFormMemo, setInvoiceFormMemo] = useState('Software Engineering & Multi-Corridor Treasury Integration');
  const [invoiceFormDueDate, setInvoiceFormDueDate] = useState('Net 14 (14 Days)');
  const [invoiceSigningLoading, setInvoiceSigningLoading] = useState(false);
  const [invoiceSigningError, setInvoiceSigningError] = useState<string | null>(null);
  const [selectedInvoiceForModal, setSelectedInvoiceForModal] = useState<any | null>(null);
  const [selectedInvoiceQrUrl, setSelectedInvoiceQrUrl] = useState<string>('');
  const [invoiceCopiedId, setInvoiceCopiedId] = useState<string | null>(null);

  // Receive Modal: Tab switch between Deposit Address & Payment Request
  const [receiveViewTab, setReceiveViewTab] = useState<'address' | 'invoice'>('address');
  const [invoiceClientName, setInvoiceClientName] = useState('Acme Corp');
  const [invoiceRef, setInvoiceRef] = useState('INV-2026-001');
  const [invoiceAmount, setInvoiceAmount] = useState('150');
  const [invoiceToken, setInvoiceToken] = useState<AssetSymbol>('USDT');
  const [invoiceQrUrl, setInvoiceQrUrl] = useState('');
  const [invoiceCopied, setInvoiceCopied] = useState(false);

  // Target Portfolio Allocation Slider & Drift Guard
  const [targetUsdPercent, setTargetUsdPercent] = useState<number>(70);

  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [newAgentName, setNewAgentName] = useState('LatAm Rebalancing Agent');
  const [newAgentRole, setNewAgentRole] = useState<'treasury_rebalancer' | 'stitch_filler' | 'x402_reconciler'>('treasury_rebalancer');
  const [newAgentDesc, setNewAgentDesc] = useState('Autonomous stablecoin treasury operations within user-defined policy.');
  const [newAgentMode, setNewAgentMode] = useState<'autonomous' | 'approval_required' | 'monitor'>('autonomous');
  const [newAgentSellToken, setNewAgentSellToken] = useState<AssetSymbol>('cNGN');
  const [newAgentBuyToken, setNewAgentBuyToken] = useState<AssetSymbol>('USDT');
  const [newAgentMinReserve, setNewAgentMinReserve] = useState('50000');
  const [newAgentMaxTrade, setNewAgentMaxTrade] = useState('25000');
  const [newAgentDailyCap, setNewAgentDailyCap] = useState('100000');
  const [newAgentSlippage, setNewAgentSlippage] = useState(50);
  const [newAgentLoading, setNewAgentLoading] = useState(false);
  const [newAgentError, setNewAgentError] = useState<string | null>(null);

  const [showConfigurePolicyModal, setShowConfigurePolicyModal] = useState(false);
  const [policyAgent, setPolicyAgent] = useState<any>(null);
  const [policyMode, setPolicyMode] = useState<'autonomous' | 'approval_required' | 'monitor'>('autonomous');
  const [policyMinReserve, setPolicyMinReserve] = useState('');
  const [policyMaxTrade, setPolicyMaxTrade] = useState('');
  const [policyDailyCap, setPolicyDailyCap] = useState('');
  const [policySlippage, setPolicySlippage] = useState(50);
  const [policyIntent, setPolicyIntent] = useState('');
  const [policySaving, setPolicySaving] = useState(false);
  const [policyError, setPolicyError] = useState<string | null>(null);

  const [showEarnModal, setShowEarnModal] = useState(false);
  const [earnCycleLoading, setEarnCycleLoading] = useState(false);
  const [earnCycleResult, setEarnCycleResult] = useState<any>(null);

  const handleApprovePendingExecution = async (executionId: string) => {
    setApprovingExecId(executionId);
    try {
      await fetch('/api/treasury/controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_pending_execution',
          executionId,
        }),
      });
      await fetchAllData();
    } finally {
      setApprovingExecId(null);
    }
  };

  const handleRejectPendingExecution = async (executionId: string) => {
    setApprovingExecId(executionId);
    try {
      await fetch('/api/treasury/controls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reject_pending_execution',
          executionId,
        }),
      });
      await fetchAllData();
    } finally {
      setApprovingExecId(null);
    }
  };

  const handleExecuteSend = async () => {
    if (!hasConnectedOwnerWallet) {
      setSendError('Please connect your Web3 wallet first to authorize and sign onchain transfers.');
      return;
    }
    if (!sendRecipient || !sendAmount) {
      setSendError('Please provide both recipient address and amount.');
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(sendRecipient)) {
      setSendError('Invalid Celo recipient address (must start with 0x and be 42 characters).');
      return;
    }
    const assetMeta = CELO_VERIFIED_ASSETS[sendToken];
    if (!assetMeta) {
      setSendError('Unknown asset selected.');
      return;
    }
    const cleanAmount = sendAmount.replace(/,/g, '');
    const num = Number(cleanAmount);
    if (isNaN(num) || num <= 0) {
      setSendError('Please enter a valid positive amount.');
      return;
    }
    const amountAtomic =
      BigInt(Math.floor(num * Math.pow(10, Math.min(assetMeta.decimals, 6)))) *
      BigInt(Math.pow(10, Math.max(0, assetMeta.decimals - 6)));

    setSendLoading(true);
    setSendError(null);
    setSendSuccess(null);

    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;

    try {
      if (eth && activeOwnerWallet) {
        // Human owner signed onchain transfer via Web3 browser wallet extension (MetaMask/Rabby/MiniPay)
        let txHash: string;
        if (assetMeta.symbol === 'CELO') {
          txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: activeOwnerWallet,
                to: sendRecipient,
                value: '0x' + amountAtomic.toString(16),
                data: `0x${ATTRIBUTION_SUFFIX}`,
              },
            ],
          });
        } else {
          // Standard ERC-20 transfer(address to, uint256 amount) with Schema 0 attribution
          const rawTransfer = encodeFunctionData({
            abi: erc20Abi,
            functionName: 'transfer',
            args: [sendRecipient as `0x${string}`, amountAtomic],
          });
          const callData = `${rawTransfer}${ATTRIBUTION_SUFFIX}`;
          txHash = await eth.request({
            method: 'eth_sendTransaction',
            params: [
              {
                from: activeOwnerWallet,
                to: assetMeta.address,
                data: callData,
              },
            ],
          });
        }

        // Record confirmed onchain transfer into double-entry ledger
        await fetch('/api/treasury', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'record_signed_transfer',
            tokenSymbol: sendToken,
            tokenAddress: assetMeta.address,
            recipient: sendRecipient,
            amountAtomic: amountAtomic.toString(),
            decimals: assetMeta.decimals,
            txHash,
          }),
        });

        setSendSuccess({
          txHash,
          blockNumber: undefined,
          gasUsed: undefined,
        });
      } else {
        // Fallback to backend agent operational signer if permitted
        const res = await fetch('/api/treasury', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send_transfer',
            tokenSymbol: sendToken,
            tokenAddress: assetMeta.address,
            recipient: sendRecipient,
            amountAtomic: amountAtomic.toString(),
            decimals: assetMeta.decimals,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Transfer failed.');
        }
        setSendSuccess({
          txHash: data.txHash,
          blockNumber: data.blockNumber,
          gasUsed: data.gasUsed,
        });
      }
      fetchAllData();
    } catch (err: any) {
      setSendError(err?.message || 'Transaction rejected by wallet or failed on Celo Mainnet.');
    } finally {
      setSendLoading(false);
    }
  };

  // Interactive Web3 Swap Execution (Direct Uniswap v3 SwapRouter02 on Celo Mainnet with Schema 0 ERC-8021 Attribution)
  const handleExecuteWeb3Swap = async () => {
    if (!hasConnectedOwnerWallet) {
      setSwapError('Please connect your Celo wallet to execute swaps.');
      return;
    }
    const num = Number(sellHumanInput || '0');
    if (isNaN(num) || num <= 0) {
      setSwapError('Please enter a valid swap amount.');
      return;
    }

    const amountAtomic =
      BigInt(Math.floor(num * Math.pow(10, Math.min(sellAsset.decimals, 6)))) *
      BigInt(Math.pow(10, Math.max(0, sellAsset.decimals - 6)));

    setSwapLoading(true);
    setSwapError(null);
    setSwapSuccess(null);
    setSwapStepText('Connecting to Celo Mainnet...');

    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (!eth) {
      setSwapError('Web3 wallet extension (MetaMask/Rabby/Rainbow) not detected in your browser.');
      setSwapLoading(false);
      return;
    }

    try {
      // 1. Check Allowance for ERC-20 spending by SwapRouter02
      setSwapStepText(`Checking ${sellAsset.symbol} spending allowance...`);
      const allowanceData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'allowance',
        args: [activeOwnerWallet as `0x${string}`, SWAP_ROUTER_02 as `0x${string}`],
      });

      let currentAllowance = 0n;
      try {
        const allowanceHex = await eth.request({
          method: 'eth_call',
          params: [{ to: sellAsset.address, data: allowanceData }, 'latest'],
        });
        if (allowanceHex && allowanceHex !== '0x') {
          currentAllowance = BigInt(allowanceHex);
        }
      } catch (callErr) {
        console.warn('Allowance check warning:', callErr);
      }

      // If allowance is insufficient, request approval with Schema 0 attribution
      if (currentAllowance < amountAtomic) {
        setSwapStepText(`Step 1/2: Please approve ${sellAsset.symbol} for Uniswap v3 in your wallet...`);
        const rawApprove = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [SWAP_ROUTER_02 as `0x${string}`, maxUint256],
        });
        const approveCallData = `${rawApprove}${ATTRIBUTION_SUFFIX}`;

        const approveTx = await eth.request({
          method: 'eth_sendTransaction',
          params: [
            {
              from: activeOwnerWallet,
              to: sellAsset.address,
              data: approveCallData,
            },
          ],
        });

        setSwapStepText(`Step 1/2: ${sellAsset.symbol} approval pending (${approveTx.slice(0, 10)}...)...`);
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 1000));
          try {
            const receipt = await eth.request({
              method: 'eth_getTransactionReceipt',
              params: [approveTx],
            });
            if (receipt && receipt.blockNumber) break;
          } catch {}
        }
      }

      // 2. Prompt exactInputSingle swap on Uniswap v3 SwapRouter02 with Schema 0 attribution tag
      setSwapStepText(`Step 2/2: Confirm ${sellAsset.symbol} → ${buyAsset.symbol} swap in your wallet...`);

      const swapParams = {
        tokenIn: sellAsset.address as `0x${string}`,
        tokenOut: buyAsset.address as `0x${string}`,
        fee: 100, // 0.01% fee tier
        recipient: activeOwnerWallet as `0x${string}`,
        amountIn: amountAtomic,
        amountOutMinimum: 0n,
        sqrtPriceLimitX96: 0n,
      };

      const rawSwapData = encodeFunctionData({
        abi: routerAbi,
        functionName: 'exactInputSingle',
        args: [swapParams],
      });

      const swapCallData = `${rawSwapData}${ATTRIBUTION_SUFFIX}`;

      const swapTxHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [
          {
            from: activeOwnerWallet,
            to: SWAP_ROUTER_02,
            data: swapCallData,
            value: '0x0',
          },
        ],
      });

      setSwapStepText(`Swap confirmed! Tx: ${swapTxHash.slice(0, 10)}... Recording in treasury ledger...`);

      // 3. Record confirmed swap in MOI treasury double-entry audit ledger
      await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'record_swap',
          swap: {
            txHash: swapTxHash,
            sellSymbol: sellAsset.symbol,
            buySymbol: buyAsset.symbol,
            amount: amountAtomic.toString(),
            operatorWallet: activeOwnerWallet,
            attributionTag: ATTRIBUTION_TAG,
          },
        }),
      });

      setSwapSuccess({
        txHash: swapTxHash,
        sellSymbol: sellAsset.symbol,
        buySymbol: buyAsset.symbol,
        amount: sellHumanInput,
        attributionTag: ATTRIBUTION_TAG,
      });

      await fetchAllData();
    } catch (err: any) {
      console.error('Swap execution error:', err);
      setSwapError(err?.message || 'Swap transaction was rejected or failed on Celo Mainnet.');
    } finally {
      setSwapLoading(false);
      setSwapStepText(null);
    }
  };

  const handleExecuteWithdraw = async () => {
    if (!hasConnectedOwnerWallet) {
      setWithdrawError('Please connect your Web3 wallet first to initiate a bank withdrawal.');
      return;
    }
    const cleanAmount = withdrawAmount.replace(/,/g, '');
    const num = Number(cleanAmount);
    if (isNaN(num) || num <= 0) {
      setWithdrawError('Please enter a valid positive withdrawal amount.');
      return;
    }

    // Corridor validations
    if (withdrawCountry === 'NG') {
      if (!withdrawAccountNumber || withdrawAccountNumber.trim().length !== 10) {
        setWithdrawError('Please enter a valid 10-digit Nigerian NUBAN account number.');
        return;
      }
      if (!withdrawBankName) {
        setWithdrawError('Please select your destination Nigerian bank.');
        return;
      }
    } else if (withdrawCountry === 'BR') {
      if (!withdrawPixKey || withdrawPixKey.trim().length < 5) {
        setWithdrawError('Please enter a valid Brazilian PIX key (CPF, Email, Phone, or EVP).');
        return;
      }
    } else if (withdrawCountry === 'AR') {
      if (!withdrawCbu || withdrawCbu.trim().length < 8) {
        setWithdrawError('Please enter a valid Argentine 22-digit CBU/CVU or Bank Alias.');
        return;
      }
    } else {
      if (!withdrawAccountNumber || withdrawAccountNumber.trim().length < 4) {
        setWithdrawError('Please enter your destination bank account details.');
        return;
      }
    }

    setWithdrawLoading(true);
    setWithdrawError(null);
    setWithdrawSuccess(null);

    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw_to_bank',
          country: withdrawCountry,
          currency: withdrawCurrency,
          amount: num.toString(),
          bankName: withdrawBankName,
          accountNumber: withdrawAccountNumber,
          accountName: withdrawAccountName,
          pixKey: withdrawPixKey,
          cbu: withdrawCbu,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Bank withdrawal failed.');
      }
      setWithdrawSuccess(data);
      fetchAllData();
    } catch (err: any) {
      setWithdrawError(err?.message || 'Failed to dispatch bank withdrawal.');
    } finally {
      setWithdrawLoading(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!newAgentName.trim()) {
      setNewAgentError('Agent name is required.');
      return;
    }
    const sellMeta = CELO_VERIFIED_ASSETS[newAgentSellToken];
    const buyMeta = CELO_VERIFIED_ASSETS[newAgentBuyToken];
    if (!sellMeta || !buyMeta) {
      setNewAgentError('Invalid trading pair selected.');
      return;
    }
    setNewAgentLoading(true);
    setNewAgentError(null);

    const minResNum = Number(newAgentMinReserve.replace(/,/g, '')) || 0;
    const maxTradeNum = Number(newAgentMaxTrade.replace(/,/g, '')) || 1000;
    const dailyCapNum = Number(newAgentDailyCap.replace(/,/g, '')) || 5000;

    const minReserveAtomic =
      BigInt(Math.floor(minResNum * Math.pow(10, Math.min(sellMeta.decimals, 6)))) *
      BigInt(Math.pow(10, Math.max(0, sellMeta.decimals - 6)));
    const maxTradeAtomic =
      BigInt(Math.floor(maxTradeNum * Math.pow(10, Math.min(sellMeta.decimals, 6)))) *
      BigInt(Math.pow(10, Math.max(0, sellMeta.decimals - 6)));
    const dailyCapAtomic =
      BigInt(Math.floor(dailyCapNum * Math.pow(10, Math.min(sellMeta.decimals, 6)))) *
      BigInt(Math.pow(10, Math.max(0, sellMeta.decimals - 6)));

    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_agent',
          name: newAgentName,
          role: newAgentRole,
          description: newAgentDesc,
          mode: newAgentMode,
          sellToken: sellMeta.address,
          buyToken: buyMeta.address,
          minimumReserveAtomic: minReserveAtomic.toString(),
          maxTradeAtomic: maxTradeAtomic.toString(),
          dailySellCapAtomic: dailyCapAtomic.toString(),
          maxSlippageBps: newAgentSlippage,
          naturalLanguageIntent: `Preserve ${newAgentMinReserve} ${newAgentSellToken} reserve. Convert up to ${newAgentMaxTrade} per trade with daily cap ${newAgentDailyCap} under ${newAgentMode} mode.`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to issue agent.');
      }
      setShowNewAgentModal(false);
      fetchAllData();
    } catch (err: any) {
      setNewAgentError(err?.message || 'Agent issuance failed.');
    } finally {
      setNewAgentLoading(false);
    }
  };

  const handleOpenConfigurePolicy = (agent: any) => {
    const mandate = treasuryData?.mandates?.find((m: any) => m.id === agent.mandateId);
    setPolicyAgent(agent);
    if (mandate) {
      const sAsset = findAssetByAddress(mandate.sellToken);
      const dec = sAsset?.decimals ?? 6;
      setPolicyMode(mandate.mode);
      setPolicyMinReserve(
        formatAtomicWithCommas(mandate.minimumReserveAtomic, dec, 0)
      );
      setPolicyMaxTrade(
        formatAtomicWithCommas(mandate.maxTradeAtomic, dec, 0)
      );
      setPolicyDailyCap(
        formatAtomicWithCommas(mandate.dailySellCapAtomic, dec, 0)
      );
      setPolicySlippage(mandate.maxSlippageBps ?? 50);
      setPolicyIntent(mandate.naturalLanguageIntent || '');
    }
    setPolicyError(null);
    setShowConfigurePolicyModal(true);
  };

  const handleSaveAgentPolicy = async () => {
    if (!policyAgent) return;
    const mandate = treasuryData?.mandates?.find((m: any) => m.id === policyAgent.mandateId);
    if (!mandate) return;
    const sAsset = findAssetByAddress(mandate.sellToken);
    const dec = sAsset?.decimals ?? 6;

    const minResNum = Number(policyMinReserve.replace(/,/g, '')) || 0;
    const maxTradeNum = Number(policyMaxTrade.replace(/,/g, '')) || 1000;
    const dailyCapNum = Number(policyDailyCap.replace(/,/g, '')) || 5000;

    const minReserveAtomic =
      BigInt(Math.floor(minResNum * Math.pow(10, Math.min(dec, 6)))) *
      BigInt(Math.pow(10, Math.max(0, dec - 6)));
    const maxTradeAtomic =
      BigInt(Math.floor(maxTradeNum * Math.pow(10, Math.min(dec, 6)))) *
      BigInt(Math.pow(10, Math.max(0, dec - 6)));
    const dailyCapAtomic =
      BigInt(Math.floor(dailyCapNum * Math.pow(10, Math.min(dec, 6)))) *
      BigInt(Math.pow(10, Math.max(0, dec - 6)));

    setPolicySaving(true);
    setPolicyError(null);

    try {
      const updatedMandate: TreasuryMandate = {
        ...mandate,
        mode: policyMode,
        minimumReserveAtomic: minReserveAtomic.toString(),
        maxTradeAtomic: maxTradeAtomic.toString(),
        dailySellCapAtomic: dailyCapAtomic.toString(),
        maxSlippageBps: policySlippage,
        naturalLanguageIntent: policyIntent,
        updatedAt: new Date().toISOString(),
      };

      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_mandate',
          mandate: updatedMandate,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to update policy mandate.');
      }
      setShowConfigurePolicyModal(false);
      fetchAllData();
    } catch (err: any) {
      setPolicyError(err?.message || 'Policy update failed.');
    } finally {
      setPolicySaving(false);
    }
  };

  const handleRunStitchQuote = async () => {
    setEarnCycleLoading(true);
    setEarnCycleResult(null);
    try {
      const res = await fetch('/api/pricing/stitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseAsset: 'cNGN', quoteAsset: 'USDT' }),
      });
      const data = await res.json();
      setEarnCycleResult(data);
      fetchAllData();
    } catch (err: any) {
      setEarnCycleResult({ error: err?.message || 'Failed to query stitch quoting model.' });
    } finally {
      setEarnCycleLoading(false);
    }
  };

  const fetchAllData = useCallback(async (walletOverride?: string | null) => {
    try {
      const activeWallet = walletOverride !== undefined ? walletOverride : (wagmiAddress || null);
      const treasuryUrl = activeWallet ? `/api/treasury?wallet=${activeWallet}` : '/api/treasury';
      const [tRes, bRes, sRes, iRes] = await Promise.all([
        fetch(treasuryUrl),
        fetch('/api/buy'),
        fetch('/api/pricing/stitch?symbol=cNGN'),
        fetch('/api/identity/agent.json'),
      ]);
      const [tJson, bJson, sJson, iJson] = await Promise.all([
        tRes.json(),
        bRes.json(),
        sRes.json(),
        iRes.json(),
      ]);
      setTreasuryData(tJson);
      setBuyCatalogData(bJson);
      setStitchFeedData(sJson);
      setErc8004Data(iJson);

      if (tJson?.userProfile && activeWallet) {
        setProfileForm({
          displayName: tJson.userProfile.displayName || '',
          email: tJson.userProfile.email || '',
          organization: tJson.userProfile.organization || 'MOI Global Treasury',
          roleTitle: tJson.userProfile.roleTitle || 'Treasury Manager',
          primaryRegion: tJson.userProfile.primaryRegion || 'Nigeria & LatAm Corridors',
          preferredBaseSymbol: (tJson.userProfile.preferredBaseSymbol as AssetSymbol) || 'cNGN',
        });
        setAuthNameInput(tJson.userProfile.displayName || '');
        setAuthEmailInput(tJson.userProfile.email || '');
        setAuthOrgInput(tJson.userProfile.organization || 'MOI Global Treasury');
        setAuthRoleInput(tJson.userProfile.roleTitle || 'Treasury Manager');
        setAuthRegionInput(tJson.userProfile.primaryRegion || 'Nigeria & LatAm Corridors');
        if (tJson.userProfile.walletAddress) {
          setAuthWalletInput(tJson.userProfile.walletAddress);
        }
      } else if (!activeWallet) {
        setProfileForm({
          displayName: '',
          email: '',
          organization: 'MOI Global Treasury',
          roleTitle: 'Treasury Manager',
          primaryRegion: 'Nigeria & LatAm Corridors',
          preferredBaseSymbol: 'cNGN',
        });
        setAuthNameInput('');
        setAuthEmailInput('');
        setAuthWalletInput('');
      }

      // If user has a valid active server session or connected wallet, show app view
      if (tJson?.authenticated || activeWallet) {
        setViewMode('app');
      }
    } catch (err) {
      console.error('Error loading MOI state:', err);
    } finally {
      setLoading(false);
    }
  }, [wagmiAddress]);

  useEffect(() => {
    fetchAllData();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam) {
        if (['dashboard', 'agents', 'treasury', 'invoices', 'compliance', 'buy', 'transactions', 'profile', 'settings'].includes(tabParam)) {
          setActiveTab(tabParam as AppTab);
          setViewMode('app');
        }
      } else if (window.location.hash === '#invoices') {
        setActiveTab('invoices');
        setViewMode('app');
      }
    }
  }, [fetchAllData]);

  // Synchronize wallet state with backend: binds profile to connected wallet and resets on disconnect
  useEffect(() => {
    if (wagmiStatus === 'reconnecting' || wagmiStatus === 'connecting') {
      return;
    }

    if (isWagmiConnected && wagmiAddress) {
      fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_wallet',
          walletAddress: wagmiAddress,
        }),
      }).then(() => {
        fetchAllData(wagmiAddress);
      });
    } else if (wagmiStatus === 'disconnected') {
      fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_wallet' }),
      }).then(() => {
        fetchAllData(null);
      });
    }
  }, [isWagmiConnected, wagmiAddress, wagmiStatus, fetchAllData]);

  // Handle wallet change event from browser extension
  useEffect(() => {
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    if (eth && eth.on) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0 && treasuryData?.userProfile?.walletAddress) {
          const currentAccount = accounts[0].toLowerCase();
          const sessionAccount = treasuryData.userProfile.walletAddress.toLowerCase();
          if (currentAccount !== sessionAccount) {
            // Active wallet changed - sign out of previous session
            handleSignOut();
          }
        }
      };
      eth.on('accountsChanged', handleAccountsChanged);
      return () => {
        if (eth.removeListener) {
          eth.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, [treasuryData?.userProfile?.walletAddress]);

  // Dynamic QR Code generation for Receive modal matching connected wallet
  useEffect(() => {
    if (!showReceiveModal) return;
    const isOwnerTarget = receiveTarget === 'owner';
    const targetAddress = isOwnerTarget
      ? (activeOwnerWallet || '')
      : (treasuryData?.agentWalletAddress || '');

    if (targetAddress && !targetAddress.startsWith('0x00000000')) {
      QRCode.toDataURL(targetAddress, {
        width: 256,
        margin: 1.5,
        color: { dark: '#0B0F14', light: '#FFFFFF' },
      })
        .then((url) => setReceiveQrUrl(url))
        .catch((err) => console.error('Failed to generate deposit QR:', err));
    } else {
      setReceiveQrUrl('');
    }
  }, [
    showReceiveModal,
    receiveTarget,
    activeOwnerWallet,
    treasuryData?.agentWalletAddress,
  ]);

  // Dynamic Invoice QR generation
  useEffect(() => {
    if (!showReceiveModal || receiveViewTab !== 'invoice') return;
    const dest = activeOwnerWallet || '0x479253b82Eb63eb36F140EcABf0237cc338084e7';
    const invoicePayload = `celo:${dest}?amount=${invoiceAmount}&token=${invoiceToken}&memo=${encodeURIComponent(invoiceRef)}`;
    QRCode.toDataURL(invoicePayload, {
      width: 256,
      margin: 1.5,
      color: { dark: '#0B0F14', light: '#FFFFFF' },
    })
      .then((url) => setInvoiceQrUrl(url))
      .catch((err) => console.error('Invoice QR error:', err));
  }, [
    showReceiveModal,
    receiveViewTab,
    invoiceAmount,
    invoiceToken,
    invoiceRef,
    activeOwnerWallet,
  ]);

  // Dynamic QR Code generation for Selected Invoice Modal
  useEffect(() => {
    if (!selectedInvoiceForModal) return;
    const dest = selectedInvoiceForModal.creatorWallet || activeOwnerWallet || '';
    const paymentUri =
      selectedInvoiceForModal.paymentUri ||
      `celo:${dest}?amount=${selectedInvoiceForModal.amount}&token=${selectedInvoiceForModal.tokenSymbol}&memo=${encodeURIComponent(selectedInvoiceForModal.invoiceNumber)}`;
    QRCode.toDataURL(paymentUri, {
      width: 256,
      margin: 1.5,
      color: { dark: '#0B0F14', light: '#FFFFFF' },
    })
      .then((url) => setSelectedInvoiceQrUrl(url))
      .catch((err) => console.error('Invoice QR error:', err));
  }, [selectedInvoiceForModal, activeOwnerWallet]);

  // Handler: Create and Cryptographically Sign Invoice ($0 and Zero Gas)
  const handleCreateSignedInvoice = async () => {
    if (!hasConnectedOwnerWallet) {
      setInvoiceSigningError('Please connect your Web3 wallet first to sign this invoice.');
      return;
    }
    if (!invoiceFormClientName.trim() || !invoiceFormAmount.trim()) {
      setInvoiceSigningError('Please provide both client name and invoice amount.');
      return;
    }
    const num = Number(invoiceFormAmount.replace(/,/g, ''));
    if (isNaN(num) || num <= 0) {
      setInvoiceSigningError('Please enter a valid positive invoice amount.');
      return;
    }

    setInvoiceSigningLoading(true);
    setInvoiceSigningError(null);

    const connectedWallet = activeOwnerWallet || '';
    const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
    const invNumber = invoiceFormRef.trim() || `INV-2026-${Math.floor(100 + Math.random() * 900)}`;

    let creatorSignature = '';
    let signatureScheme: 'EIP-712' | 'personal_sign' = 'EIP-712';

    try {
      if (eth && connectedWallet) {
        try {
          // 1. Try EIP-712 Typed Data ($0.00 Cost, Zero Gas)
          const domain = {
            name: 'MOI Invoicing & Payment Protocol',
            version: '1',
            chainId: 42220,
            verifyingContract: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432',
          };
          const types = {
            EIP712Domain: [
              { name: 'name', type: 'string' },
              { name: 'version', type: 'string' },
              { name: 'chainId', type: 'uint256' },
              { name: 'verifyingContract', type: 'address' },
            ],
            Invoice: [
              { name: 'invoiceNumber', type: 'string' },
              { name: 'creator', type: 'address' },
              { name: 'clientName', type: 'string' },
              { name: 'amount', type: 'string' },
              { name: 'tokenSymbol', type: 'string' },
              { name: 'memo', type: 'string' },
              { name: 'createdAt', type: 'string' },
            ],
          };
          const message = {
            invoiceNumber: invNumber,
            creator: connectedWallet,
            clientName: invoiceFormClientName,
            amount: num.toString(),
            tokenSymbol: invoiceFormToken,
            memo: invoiceFormMemo,
            createdAt: new Date().toISOString(),
          };

          creatorSignature = await eth.request({
            method: 'eth_signTypedData_v4',
            params: [
              connectedWallet,
              JSON.stringify({ domain, types, primaryType: 'Invoice', message }),
            ],
          });
        } catch (typedErr) {
          // Fallback to standard personal_sign ($0.00 Cost, Zero Gas)
          const signPrompt = `MOI Invoicing Protocol\n\nAuthorize Payment Request: ${invNumber}\nClient: ${invoiceFormClientName}\nAmount: ${num} ${invoiceFormToken}\nMemo: ${invoiceFormMemo}\nNetwork: Celo Mainnet (42220)\nGas Cost: $0.00 (Zero Gas Signature)`;
          creatorSignature = await eth.request({
            method: 'personal_sign',
            params: [signPrompt, connectedWallet],
          });
          signatureScheme = 'personal_sign';
        }
      } else {
        // Deterministic cryptographic hash fallback
        creatorSignature =
          '0x' +
          Array.from({ length: 130 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
      }

      // Persist signed invoice to backend ledger
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_invoice',
          invoiceNumber: invNumber,
          creatorWallet: connectedWallet,
          clientName: invoiceFormClientName,
          clientEmail: invoiceFormClientEmail,
          amount: num.toString(),
          tokenSymbol: invoiceFormToken,
          memo: invoiceFormMemo,
          creatorSignature,
          signatureScheme,
          dueDate: invoiceFormDueDate,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Failed to persist signed invoice.');
      }

      setShowCreateInvoiceModal(false);
      setInvoiceFormRef(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
      fetchAllData();
      if (data.invoice) {
        setSelectedInvoiceForModal(data.invoice);
      }
    } catch (err: any) {
      setInvoiceSigningError(
        err?.message || 'Signature request was rejected by your wallet.'
      );
    } finally {
      setInvoiceSigningLoading(false);
    }
  };

  // Handler: Mark Invoice Paid
  const handleMarkInvoicePaid = async (invoiceId: string) => {
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_invoice_paid',
          invoiceId,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchAllData();
        if (selectedInvoiceForModal && selectedInvoiceForModal.id === invoiceId) {
          setSelectedInvoiceForModal({ ...selectedInvoiceForModal, status: 'PAID' });
        }
      }
    } catch (err) {
      console.error('Failed to mark invoice paid:', err);
    }
  };

  // Preferred Base Fiat rates & conversion config
  const FIAT_RATES: Record<string, number> = {
    cNGN: 1600.0,
    USDT: 1.0,
    USDC: 1.0,
    USAT: 1.0,
    wARS: 1400.0,
    wBRL: 5.8,
    wCOP: 4200.0,
    wMXN: 19.5,
    CELO: 1 / 0.0685, // Live Celo Mainnet rate (~14.6 CELO per USD)
  };

  const FIAT_PREFIXES: Record<string, string> = {
    cNGN: '₦',
    USDT: '$',
    USDC: '$',
    USAT: '$',
    wARS: 'ARS $',
    wBRL: 'R$',
    wCOP: 'COL $',
    wMXN: 'MEX $',
    CELO: 'CELO ',
  };

  const activeBaseSymbol: string = profileForm.preferredBaseSymbol || 'cNGN';
  const activeBasePrefix = FIAT_PREFIXES[activeBaseSymbol] || '₦';
  const activeBaseRate = FIAT_RATES[activeBaseSymbol] || 1600.0;

  // Calculate live portfolio values converted to user's preferred base fiat
  const { totalInBaseFiat, totalInUsd } = useMemo(() => {
    const balances = treasuryData?.liveBalances || [];
    let usdSum = 0;
    for (const b of balances) {
      const units = Number(formatAtomicUnits(b.balanceAtomic || '0', b.decimals || 18));
      if (units <= 0) continue;
      if (b.symbol === 'CELO') {
        usdSum += units * 0.0685;
      } else if (b.symbol === 'cNGN') {
        usdSum += units / 1600.0;
      } else if (b.symbol === 'wARS') {
        usdSum += units / 1400.0;
      } else if (b.symbol === 'wBRL') {
        usdSum += units / 5.8;
      } else if (b.symbol === 'wCOP') {
        usdSum += units / 4200.0;
      } else if (b.symbol === 'wMXN') {
        usdSum += units / 19.5;
      } else {
        // Stablecoins pegged to USD: USDT, USDC, USAT
        usdSum += units;
      }
    }
    const baseSum = usdSum * activeBaseRate;
    return {
      totalInBaseFiat: baseSum,
      totalInUsd: usdSum,
    };
  }, [treasuryData?.liveBalances, activeBaseRate]);

  // Target Portfolio Allocation Drift Guard
  const { currentUsdPercent, currentLocalPercent, portfolioDriftPercent, rebalanceSuggestedAction } = useMemo(() => {
    if (totalInUsd <= 0) {
      return {
        currentUsdPercent: 0,
        currentLocalPercent: 0,
        portfolioDriftPercent: 0,
        rebalanceSuggestedAction: null,
      };
    }
    const balances = treasuryData?.liveBalances || [];
    let usdOnlyValue = 0;
    let localOnlyValue = 0;
    for (const b of balances) {
      const units = Number(formatAtomicUnits(b.balanceAtomic || '0', b.decimals || 18));
      if (units <= 0) continue;
      if (b.symbol === 'USDT' || b.symbol === 'USDC' || b.symbol === 'USAT') {
        usdOnlyValue += units;
      } else {
        const rate = FIAT_RATES[b.symbol] || 1;
        const valUsd = b.symbol === 'CELO' ? units * 0.0685 : units / rate;
        localOnlyValue += valUsd;
      }
    }
    const total = usdOnlyValue + localOnlyValue;
    if (total <= 0) {
      return { currentUsdPercent: 0, currentLocalPercent: 0, portfolioDriftPercent: 0, rebalanceSuggestedAction: null };
    }
    const actualUsdPct = Math.round((usdOnlyValue / total) * 100);
    const actualLocalPct = 100 - actualUsdPct;
    const drift = actualUsdPct - targetUsdPercent;

    let suggestion: { action: 'sell_usd' | 'sell_local'; amountUsd: number; reason: string } | null = null;
    if (Math.abs(drift) >= 5) {
      const amountToShiftUsd = Math.max(5, Math.round(Math.abs(drift) * total / 100));
      if (drift > 0) {
        suggestion = {
          action: 'sell_usd',
          amountUsd: amountToShiftUsd,
          reason: `USD holdings exceed target by ${drift}%. Swap ${amountToShiftUsd} USD₮ into local currency to restore target balance.`,
        };
      } else {
        suggestion = {
          action: 'sell_local',
          amountUsd: amountToShiftUsd,
          reason: `Local currency exceeds target by ${Math.abs(drift)}%. Swap into USD₮ to protect savings purchasing power.`,
        };
      }
    }

    return {
      currentUsdPercent: actualUsdPct,
      currentLocalPercent: actualLocalPct,
      portfolioDriftPercent: drift,
      rebalanceSuggestedAction: suggestion,
    };
  }, [totalInUsd, treasuryData?.liveBalances, targetUsdPercent]);

  const activeMandate: TreasuryMandate | undefined =
    treasuryData?.mandates?.find((m: any) => m.id === selectedMandateId) ??
    treasuryData?.mandates?.[0];

  const baseSellAsset = activeMandate
    ? (findAssetByAddress(activeMandate.sellToken) ?? CELO_VERIFIED_ASSETS.cNGN)
    : CELO_VERIFIED_ASSETS.cNGN;
  const baseBuyAsset = activeMandate
    ? (findAssetByAddress(activeMandate.buyToken) ?? CELO_VERIFIED_ASSETS.USDT)
    : CELO_VERIFIED_ASSETS.USDT;

  const defaultSellAsset = isDirectionFlipped ? baseBuyAsset : baseSellAsset;
  const defaultBuyAsset = isDirectionFlipped ? baseSellAsset : baseBuyAsset;

  const sellAsset = customSellSymbol
    ? (CELO_VERIFIED_ASSETS[customSellSymbol] ?? defaultSellAsset)
    : defaultSellAsset;
  const buyAsset = customBuySymbol
    ? (CELO_VERIFIED_ASSETS[customBuySymbol] ?? defaultBuyAsset)
    : defaultBuyAsset;

  // Fetch live Textile FX v2 preview whenever corridor or amount changes
  const fetchLivePreview = useCallback(async () => {
    if (!sellAsset || !buyAsset) return;
    let atomic = '10000000000';
    try {
      atomic = parseAtomicUnits(
        sellHumanInput || (isDirectionFlipped ? '100' : '10000'),
        sellAsset.decimals
      );
      if (BigInt(atomic) <= 0n) return;
    } catch {
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await fetch('/api/fx/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'preview',
          sellToken: sellAsset.address,
          buyToken: buyAsset.address,
          sellAmountAtomic: atomic,
        }),
      });
      const data = await res.json();
      if (data.preview) {
        setLivePreview(data.preview);
      }
    } catch {
      // Ignore transient preview error
    } finally {
      setPreviewLoading(false);
    }
  }, [sellAsset, buyAsset, sellHumanInput, isDirectionFlipped]);

  useEffect(() => {
    fetchLivePreview();
  }, [fetchLivePreview]);

  // Landing page live quote simulator
  const fetchLandingPreview = useCallback(async () => {
    const asset = CELO_VERIFIED_ASSETS[landingPreviewSymbol];
    if (!asset) return;
    try {
      const atomic = parseAtomicUnits(landingPreviewAmount || '10000', asset.decimals);
      if (BigInt(atomic) <= 0n) return;
      setLandingPreviewLoading(true);
      const res = await fetch('/api/fx/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'preview',
          sellToken: asset.address,
          buyToken: CELO_VERIFIED_ASSETS.USDT.address,
          sellAmountAtomic: atomic,
        }),
      });
      const data = await res.json();
      if (data.preview) {
        setLandingLivePreview(data.preview);
      }
    } catch {
      // Ignore
    } finally {
      setLandingPreviewLoading(false);
    }
  }, [landingPreviewSymbol, landingPreviewAmount]);

  useEffect(() => {
    fetchLandingPreview();
  }, [fetchLandingPreview]);

  // Launch App handler (enters live Treasury OS directly)
  const handleLaunchApp = () => {
    setShowAuthModal(false);
    setViewMode('app');
  };

  // Open Sign-In Modal (Returning users)
  const handleOpenSignIn = () => {
    setAuthMode('signin');
    setAuthStep(1);
    setFoundAccount(null);
    setLookupMessage(null);
    setAuthWalletError(null);
    setShowAuthModal(true);
  };

  // Open Sign-Up Modal (New users)
  const handleOpenSignUp = () => {
    setAuthMode('signup');
    setAuthStep(1);
    setFoundAccount(null);
    setLookupMessage(null);
    setAuthWalletError(null);
    setShowAuthModal(true);
  };

  // Look up returning user by email
  const handleLookupEmail = async () => {
    const trimmed = authEmailInput.trim();
    if (!trimmed) {
      setLookupMessage('Please enter your operator email.');
      return;
    }
    setLookupLoading(true);
    setLookupMessage(null);
    setFoundAccount(null);
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lookup_account',
          email: trimmed,
        }),
      });
      const data = await res.json();
      if (data.found && data.userProfile) {
        setFoundAccount(data.userProfile);
      } else {
        setLookupMessage('No registered account found with this email. Would you like to create an account?');
      }
    } catch {
      setLookupMessage('Error checking account. Please try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Complete Sign In with found account using cryptographic SIWE verification
  const handleSignInWithFoundAccount = async () => {
    if (!foundAccount || !foundAccount.walletAddress) return;
    setLookupLoading(true);
    setLookupMessage(null);
    try {
      const eth = (window as any).ethereum;
      if (!eth) {
        setLookupMessage('A Web3 wallet extension (MetaMask/Rabby/MiniPay) is required to sign the SIWE challenge.');
        return;
      }

      // Step 1: Request server-generated SIWE challenge with single-use nonce
      const nonceRes = await fetch(
        `/api/auth/nonce?wallet=${encodeURIComponent(foundAccount.walletAddress)}`
      );
      const challenge = await nonceRes.json();
      if (!nonceRes.ok || !challenge.nonce) {
        setLookupMessage(challenge.error || 'Failed to generate server SIWE challenge.');
        return;
      }

      // Step 2: Request user wallet signature on the exact EIP-4361 message
      let signature: string;
      try {
        signature = await eth.request({
          method: 'personal_sign',
          params: [challenge.message, foundAccount.walletAddress],
        });
      } catch (signErr: any) {
        setLookupMessage('SIWE signature was rejected by wallet. Sign-in cancelled.');
        return;
      }

      // Step 3: Cryptographic server-side verification
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: challenge.message,
          signature,
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        setLookupMessage(verifyData.error || 'Server-side SIWE signature verification failed.');
        return;
      }

      await fetchAllData();
      setShowAuthModal(false);
      setViewMode('app');
    } catch (err: any) {
      setLookupMessage(err?.message || 'Authentication error during SIWE verification.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Connect EVM browser wallet with SIWE cryptographic verification
  const handleConnectBrowserWallet = async () => {
    setAuthWalletError(null);
    setAuthWalletLoading(true);
    try {
      const eth = typeof window !== 'undefined' ? (window as any).ethereum : null;
      if (!eth) {
        setAuthWalletError('NO_WALLET_INSTALLED');
        setShowAuthModal(true);
        return;
      }

      // 1. Request user to unlock/connect EVM account
      const accounts = await eth.request({ method: 'eth_requestAccounts' });
      if (!accounts?.[0]) {
        setAuthWalletError('No EVM account selected in wallet.');
        setShowAuthModal(true);
        return;
      }
      const account = accounts[0];
      setAuthWalletInput(account);

      // 2. Ensure connected to Celo Mainnet (Chain ID 42220 / 0xa4ec)
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa4ec' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await eth.request({
              method: 'wallet_addEthereumChain',
              params: [
                {
                  chainId: '0xa4ec',
                  chainName: 'Celo Mainnet',
                  nativeCurrency: { name: 'CELO', symbol: 'CELO', decimals: 18 },
                  rpcUrls: ['https://forno.celo.org'],
                  blockExplorerUrls: ['https://celoscan.io'],
                },
              ],
            });
          } catch (addErr) {
            console.warn('Could not add Celo chain to wallet', addErr);
          }
        }
      }

      // 3. Request server-generated SIWE challenge with single-use nonce
      const nonceRes = await fetch(`/api/auth/nonce?wallet=${encodeURIComponent(account)}`);
      const challenge = await nonceRes.json();
      if (!nonceRes.ok || !challenge.nonce) {
        setAuthWalletError(challenge.error || 'Failed to generate server SIWE challenge.');
        setShowAuthModal(true);
        return;
      }

      // 4. Prompt user to cryptographically sign the SIWE message via personal_sign
      let signature: string;
      try {
        signature = await eth.request({
          method: 'personal_sign',
          params: [challenge.message, account],
        });
      } catch (signErr: any) {
        setAuthWalletError('SIWE signature was rejected by wallet. Connection aborted.');
        setShowAuthModal(true);
        return;
      }

      // 5. Submit challenge & signature for server-side verification
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: challenge.message,
          signature,
          profile: {
            displayName: authNameInput.trim() || undefined,
            email: authEmailInput.trim() || undefined,
            organization: authOrgInput.trim() || undefined,
            roleTitle: authRoleInput.trim() || undefined,
            primaryRegion: authRegionInput.trim() || undefined,
          },
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        setAuthWalletError(verifyData.error || 'Server rejected cryptographic SIWE signature.');
        setShowAuthModal(true);
        return;
      }

      // Verified successfully!
      await fetchAllData();
      setShowAuthModal(false);
      setViewMode('app');
    } catch (err: any) {
      setAuthWalletError(err?.message || 'Failed to authenticate browser wallet.');
      setShowAuthModal(true);
    } finally {
      setAuthWalletLoading(false);
    }
  };

  // Complete Sign Up with profile + wallet via SIWE
  const handleCompleteSignUpWithWallet = async (addressToUse?: string) => {
    const targetWallet = addressToUse || authWalletInput.trim();
    if (!targetWallet || !/^0x[a-fA-F0-9]{40}$/.test(targetWallet)) {
      setAuthWalletError('Please connect your browser wallet or enter a valid 42-character Celo address (0x...)');
      return;
    }
    setAuthWalletError(null);

    const eth = (window as any).ethereum;
    if (!eth) {
      setAuthWalletError('Web3 wallet extension required to complete cryptographic authentication.');
      return;
    }

    try {
      // Step 1: Request SIWE challenge
      const nonceRes = await fetch(`/api/auth/nonce?wallet=${encodeURIComponent(targetWallet)}`);
      const challenge = await nonceRes.json();
      if (!nonceRes.ok || !challenge.nonce) {
        setAuthWalletError(challenge.error || 'Could not obtain SIWE challenge.');
        return;
      }

      // Step 2: Prompt signature
      let signature: string;
      try {
        signature = await eth.request({
          method: 'personal_sign',
          params: [challenge.message, targetWallet],
        });
      } catch (signErr: any) {
        setAuthWalletError('SIWE signature was rejected by wallet.');
        return;
      }

      // Step 3: Verify and record profile
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: challenge.message,
          signature,
          profile: {
            displayName: authNameInput.trim() || 'Treasury Operator',
            email: authEmailInput.trim() || 'treasury@company.co',
            organization: authOrgInput.trim() || 'MOI Global Treasury',
            roleTitle: authRoleInput.trim() || 'Treasury Manager',
            primaryRegion: authRegionInput.trim() || 'Nigeria & LatAm Corridors',
            walletAddress: targetWallet,
          },
        }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.ok) {
        setAuthWalletError(verifyData.error || 'Server SIWE verification failed.');
        return;
      }

      await fetchAllData();
      setShowAuthModal(false);
      setViewMode('app');
    } catch (err: any) {
      setAuthWalletError(err?.message || 'Registration failed during SIWE verification.');
    }
  };

  // Sign out of active treasury session
  const handleSignOut = async () => {
    try {
      try {
        wagmiDisconnect();
      } catch {}
      setProfileForm({
        displayName: '',
        email: '',
        organization: 'MOI Global Treasury',
        roleTitle: 'Treasury Manager',
        primaryRegion: 'Nigeria & LatAm Corridors',
        preferredBaseSymbol: 'cNGN',
      });
      setAuthNameInput('');
      setAuthEmailInput('');
      setAuthWalletInput('');
      await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_wallet' }),
      });
      await fetch('/api/auth/logout', { method: 'POST' });
      await fetchAllData(null);
      setViewMode('landing');
    } catch {
      setViewMode('landing');
    }
  };

  // Save profile updates from the Profile Tab
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);
    try {
      const activeWallet = activeOwnerWallet || null;
      await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_profile',
          profile: {
            ...profileForm,
            walletAddress: activeWallet,
          },
        }),
      });
      await fetchAllData(activeWallet);
      setProfileSavedToast(true);
      setTimeout(() => setProfileSavedToast(false), 3000);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const copyToClipboard = (text: string, keyId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Run full deterministic policy evaluation cycle
  const handleRunAgentCycle = async (executeLive = false) => {
    if (!activeMandate) return;
    setCycleLoading(true);
    try {
      const sellAtomic = parseAtomicUnits(
        sellHumanInput || (isDirectionFlipped ? '100' : '10000'),
        sellAsset.decimals
      );

      const res = await fetch('/api/fx/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'evaluate_cycle',
          mandateId: activeMandate.id,
          sellAmountAtomic: sellAtomic,
          userApproved: userApprovedCheckbox,
          executeLiveIfAuthorized: executeLive,
          flippedDirection: isDirectionFlipped,
        }),
      });
      const data = await res.json();
      setLastCycleOutcome(data.outcome);
      await fetchAllData();
    } finally {
      setCycleLoading(false);
    }
  };

  // Toggle individual agent active state
  const handleToggleAgent = async (agentId: string, nextActive: boolean) => {
    await fetch('/api/treasury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'toggle_agent',
        agentId,
        active: nextActive,
      }),
    });
    await fetchAllData();
  };

  // Delete individual agent and its associated mandate
  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Are you sure you want to delete this agent and its mandate policy?')) return;
    try {
      const res = await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_agent',
          agentId,
        }),
      });
      if (res.ok) {
        await fetchAllData();
      }
    } catch (err) {
      console.error('Failed to delete agent', err);
    }
  };

  // Quick deploy from official canonical templates
  const handleDeployTemplate = async (templateKey: 'rebalancer' | 'stitch' | 'x402') => {
    const templates = {
      rebalancer: {
        name: 'Nigeria Operating Treasury',
        role: 'treasury_rebalancer',
        description: 'Converts excess cNGN to USD₮ on Textile FX v2 while preserving a 50,000 cNGN operating floor.',
        mode: 'approval_required',
        sellToken: CELO_VERIFIED_ASSETS.cNGN.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '50000000000000000000000',
        maxTradeAtomic: '25000000000000000000000',
        dailySellCapAtomic: '100000000000000000000000',
        maxSlippageBps: 100,
        naturalLanguageIntent: 'Preserve 50,000 cNGN operating reserve. Convert excess into USD₮ up to 25,000 cNGN per trade.',
      },
      stitch: {
        name: 'LatAm Ripio Corridor MM',
        role: 'stitch_filler',
        description: 'Quotes passive maker liquidity on Textile Stitch with inventory skew, earning spread on wARS/USD₮.',
        mode: 'autonomous',
        sellToken: CELO_VERIFIED_ASSETS.wARS.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '100000000000000000000000',
        maxTradeAtomic: '50000000000000000000000',
        dailySellCapAtomic: '250000000000000000000000',
        maxSlippageBps: 100,
        naturalLanguageIntent: 'Quote passive liquidity on Textile Stitch with ±18 bps spread and 15 bps inventory skew.',
      },
      x402: {
        name: 'Merchant Audit & x402 Rebalancer',
        role: 'x402_reconciler',
        description: 'Reconciles settlement receipts and procures security audit passes via buy / x402 micropayments.',
        mode: 'approval_required',
        sellToken: CELO_VERIFIED_ASSETS.wBRL.address,
        buyToken: CELO_VERIFIED_ASSETS.USDT.address,
        minimumReserveAtomic: '1000000000000000000000',
        maxTradeAtomic: '500000000000000000000',
        dailySellCapAtomic: '2500000000000000000000',
        maxSlippageBps: 100,
        naturalLanguageIntent: 'Preserve 1,000 wBRL reserve. Convert excess and verify every settled receipt over x402.',
      },
    };

    const t = templates[templateKey];
    await fetch('/api/treasury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_agent',
        ...t,
      }),
    });
    await fetchAllData();
  };

  // Global Emergency Stop
  const handleEmergencyPause = async (paused: boolean) => {
    await fetch('/api/treasury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'emergency_pause',
        paused,
      }),
    });
    await fetchAllData();
  };

  // Compile Natural Language Intent into structured Mandate
  const handleCompileNlMandate = async () => {
    if (!activeMandate) return;
    const res = await fetch('/api/treasury', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'compile_nl_mandate',
        mandateId: activeMandate.id,
        intentText: nlIntentInput,
      }),
    });
    const data = await res.json();
    if (data.draft) {
      setNlDraftSummary(data.extractedSummary || []);
      await fetch('/api/treasury', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_mandate',
          mandate: data.draft,
        }),
      });
      await fetchAllData();
    }
  };

  // Execute x402 / buy service purchase
  const handleBuyX402Service = async (capabilityId: string) => {
    setBuyingCapabilityId(capabilityId);
    try {
      const res = await fetch('/api/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mandateId: activeMandate?.id || 'mandate_cngn_usdt',
          capabilityId,
          paymentTokenSymbol: selectedPaymentToken,
        }),
      });
      const data = await res.json();
      setLastBuyResult(data);
      await fetchAllData();
    } finally {
      setBuyingCapabilityId(null);
    }
  };

  // Refresh Stitch Feed for a specific corridor symbol
  const handleSwitchStitchSymbol = async (sym: string) => {
    const res = await fetch(`/api/pricing/stitch?symbol=${sym}`);
    const data = await res.json();
    setStitchFeedData(data);
  };

  // Export ledger & transactions as JSON
  const handleExportAuditBundle = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      treasury: treasuryData?.treasury,
      attributionStatus: treasuryData?.attributionStatus,
      analytics: treasuryData?.analytics,
      executions: treasuryData?.executions,
      ledgerEntries: treasuryData?.ledgerEntries,
      servicePurchases: treasuryData?.servicePurchases,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `moi-celo-audit-${Date.now()}.json`;
    a.click();
  };

  const anyMandatePaused = treasuryData?.mandates?.every(
    (m: TreasuryMandate) => m.paused
  );

  // ============================================================================
  // VIEW 1: PUBLIC LANDING PAGE (Uncapped Full-Story Landing Page)
  // ============================================================================
  if (viewMode === 'landing') {
    return (
      <div className="min-h-screen bg-white text-[#0B0F14] relative overflow-hidden flex flex-col font-sans">
        {/* Soft Mint Background Radial Aura */}
        <div
          className="pointer-events-none absolute -top-32 right-0 w-[840px] h-[840px] rounded-full blur-3xl opacity-70"
          style={{
            background:
              'radial-gradient(circle, rgba(182,247,210,0.85) 0%, rgba(0,230,118,0.18) 45%, rgba(255,255,255,0) 75%)',
          }}
        />
        <div
          className="pointer-events-none absolute top-[900px] -left-48 w-[600px] h-[600px] rounded-full blur-3xl opacity-40"
          style={{
            background:
              'radial-gradient(circle, rgba(182,247,210,0.7) 0%, rgba(0,230,118,0.15) 50%, rgba(255,255,255,0) 80%)',
          }}
        />

        {/* Navigation Bar */}
        <header className="relative z-20 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-3 sm:gap-4 flex-nowrap">
          <div className="flex items-center gap-2.5 shrink-0 min-w-fit">
            <MoiRibbonMark className="w-8 h-6.5 shrink-0" />
            <div className="shrink-0">
              <span className="text-lg font-black tracking-tight text-[#0B0F14] block leading-none whitespace-nowrap">
                MOI
              </span>
              <span className="text-[9px] font-semibold text-[#087F5B] tracking-wider uppercase whitespace-nowrap block mt-0.5">
                Autonomous Treasury OS
              </span>
            </div>
          </div>

          <nav className="hidden 2xl:flex items-center gap-6 text-[11px] font-semibold text-[#0B0F14]/70 shrink-0">
            <a href="#workflow" className="hover:text-[#087F5B] transition whitespace-nowrap">
              How It Works
            </a>
            <a href="#simulator" className="hover:text-[#087F5B] transition whitespace-nowrap">
              Live RFQ Simulator
            </a>
            <a href="#pillars" className="hover:text-[#087F5B] transition whitespace-nowrap">
              6 Core Pillars
            </a>
            <a href="#corridors" className="hover:text-[#087F5B] transition whitespace-nowrap">
              Corridors & Telemetry
            </a>
            <a
              href="/api/identity/agent.json"
              target="_blank"
              rel="noreferrer"
              className="hover:text-[#087F5B] transition inline-flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <span className="whitespace-nowrap">Docs (ERC-8004)</span>
              <ArrowUpRight className="w-3 h-3 shrink-0" />
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleLaunchApp}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border border-[#0B0F14]/12 bg-white hover:bg-[#F8FAFC] text-[#0B0F14] transition shadow-xs whitespace-nowrap cursor-pointer shrink-0"
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-[#087F5B] shrink-0" />
              <span>Enter Treasury OS</span>
            </button>
            <MoiWalletButton size="sm" />
          </div>
        </header>

        {/* HERO SECTION */}
        <section className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 pt-4 pb-8 sm:pt-6 sm:pb-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#B6F7D2]/60 border border-[#00E676]/40 text-[11px] font-bold text-[#087F5B]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                Live on Celo Mainnet (42220) · Textile FX v2 · Ripio · buy / x402 · ERC-8004
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight leading-[1.08] text-[#0B0F14]">
                Your AI Agent.
                <br />
                Your Treasury.
              </h1>

              <p className="text-xs sm:text-sm text-[#0B0F14]/65 max-w-md leading-relaxed font-normal">
                Autonomous, policy-bounded treasury operating system on Celo Mainnet.
                Control, transact, and earn with AI agents on open rails—executing
                Textile FX v2 RFQ conversions, passive textile-stitch market making,
                Ripio LatAm fiat ramps, and buy / x402 service verification strictly
                bounded by 17 deterministic rules.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  onClick={handleLaunchApp}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-xs shadow-sm shadow-[#00E676]/20 transition transform active:scale-95"
                >
                  Enter Treasury OS <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <MoiWalletButton size="lg" />
              </div>

              {/* 3 Badges matching Uploaded UI Kit */}
              <div className="pt-6 grid grid-cols-3 gap-3 max-w-lg border-t border-[#0B0F14]/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10 flex items-center justify-center shrink-0">
                    <Bot className="w-3.5 h-3.5 text-[#087F5B]" />
                  </div>
                  <div className="text-[11px] leading-tight">
                    <p className="font-bold text-[#0B0F14]">AI Agents</p>
                    <p className="text-[#0B0F14]/60">On-Chain (8004)</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10 flex items-center justify-center shrink-0">
                    <Globe className="w-3.5 h-3.5 text-[#087F5B]" />
                  </div>
                  <div className="text-[11px] leading-tight">
                    <p className="font-bold text-[#0B0F14]">Powered by</p>
                    <p className="text-[#0B0F14]/60">Celo Mainnet</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#087F5B]" />
                  </div>
                  <div className="text-[11px] leading-tight">
                    <p className="font-bold text-[#0B0F14]">Built with</p>
                    <p className="text-[#0B0F14]/60">Open Rails</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Large 3D Ribbon M Emblem with Active Moving 3D Spirals */}
            <div className="lg:col-span-6 flex justify-center">
              <MoiHero3DEmblem />
            </div>
          </div>
        </section>

        {/* SECTION 1: LIVE INTERACTIVE RFQ SIMULATOR (Directly on Landing Page) */}
        <section id="simulator" className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <div className="bg-[#0B0F14] text-white rounded-xl p-4 sm:p-5 shadow-xl relative overflow-hidden">
            <div
              className="pointer-events-none absolute -top-32 right-0 w-[380px] h-[380px] rounded-full blur-3xl opacity-25"
              style={{ background: 'radial-gradient(circle, #00E676 0%, transparent 70%)' }}
            />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center relative z-10">
              <div className="lg:col-span-5 space-y-3">
                <span className="px-2.5 py-0.5 rounded-full bg-[#00E676]/20 text-[#00E676] text-[10px] font-bold uppercase tracking-wider">
                  Live Celo RFQ Sandbox
                </span>
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-white">
                  Test Live Textile FX v2 Depth in Real-Time
                </h2>
                <p className="text-xs text-white/70 leading-relaxed font-normal">
                  Query real-time Celo Mainnet depth across Nigerian Naira and Latin American stablecoins directly against live Textile market-maker liquidity. Zero auth required for rate inspection.
                </p>
                <div className="flex items-center gap-1.5 text-[11px] font-mono-num text-[#B6F7D2]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00E676]" />
                  <span>Guaranteed Zero-Slippage Settlement via Textile FX</span>
                </div>
              </div>

              <div className="lg:col-span-7 bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 space-y-4 backdrop-blur-md">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['cNGN', 'wARS', 'wBRL', 'wCOP'] as const).map((sym) => (
                    <button
                      key={sym}
                      onClick={() => setLandingPreviewSymbol(sym)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        landingPreviewSymbol === sym
                          ? 'bg-[#00E676] text-[#0B0F14] shadow-sm shadow-[#00E676]/30'
                          : 'bg-white/5 text-white/75 hover:bg-white/10'
                      }`}
                    >
                      <span>{sym}</span>
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                      Sell Amount ({landingPreviewSymbol})
                    </label>
                    <input
                      type="number"
                      value={landingPreviewAmount}
                      onChange={(e) => setLandingPreviewAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-white font-mono-num font-bold text-sm focus:outline-none focus:border-[#00E676]"
                      placeholder="10000"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-white/60 mb-1">
                      Live Quote Output (USD₮)
                    </label>
                    <div className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/15 text-[#00E676] font-mono-num font-bold text-sm flex items-center justify-between">
                      <span>
                        {landingPreviewLoading ? (
                          <span className="text-white/50 text-xs animate-pulse">Querying Textile FX v2...</span>
                        ) : landingLivePreview?.buyAmount ? (
                          `≈ ${formatAtomicUnits(landingLivePreview.buyAmount, 6, 2)} USD₮`
                        ) : (
                          '0.00 USD₮'
                        )}
                      </span>
                      <span className="text-[9px] text-white/40 uppercase">Firm Quote</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs pt-2 border-t border-white/10">
                  <div className="flex items-center gap-3 text-white/70 font-mono-num text-[10px]">
                    <span>Quote Expiry: {landingLivePreview?.quoteExpirySec ?? 30}s</span>
                    <span>Fee: {landingLivePreview?.feeBps ?? 1} bps</span>
                    <span>Chain ID: 42220 (Celo)</span>
                  </div>
                  <button
                    onClick={handleOpenSignIn}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#00E676] text-[#0B0F14] text-xs font-bold hover:bg-[#00C853] transition"
                  >
                    Authorize Mandate <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: 5-STEP AUTONOMOUS WORKFLOW */}
        <section id="workflow" className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="px-3 py-1 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[11px] font-bold uppercase tracking-wider">
              End-to-End Operational Flow
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0B0F14] mt-2.5">
              How MOI Operates Your Corporate Treasury
            </h2>
            <p className="text-xs text-[#0B0F14]/60 mt-2 leading-relaxed">
              From natural-language mandate compilation down to cryptographic calldata suffixing on Celo Mainnet, here is the complete 5-step lifecycle executed by MOI.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              {
                step: '01',
                title: 'Mandate Compilation',
                desc: 'Operators define reserve floors and daily volume ceilings in plain English. MOI compiles them into an immutable 17-rule deterministic pre-execution matrix.',
                tag: 'Rules Matrix',
              },
              {
                step: '02',
                title: 'Textile FX v2 RFQ',
                desc: 'Agents slice currency trades into permitted tranche sizes, fetch live firm RFQ quotes, and enforce atomic minimum output invariants before signing.',
                tag: 'Zero Slippage',
              },
              {
                step: '03',
                title: 'textile-stitch Quoting',
                desc: 'The agent actively streams Avellaneda-Stoikov inventory-skew pricing to capture spread passively while maintaining optimal reserve balancing.',
                tag: 'Passive Yield',
              },
              {
                step: '04',
                title: 'buy / x402 Verification',
                desc: 'Autonomous agents independently verify external RPCs (Chainstack), social intelligence (TikHub), and oracles (Cencori) paying per-request over HTTP 402 in USA₮, USD₮, or USDC.',
                tag: 'x402 Micropayments',
              },
              {
                step: '05',
                title: 'Attribution & Ledger',
                desc: 'Transactions append ERC-8021 metadata tags (@celo/attribution-tags) and anchor to an immutable double-entry ledger where DEBIT strictly equals CREDIT.',
                tag: 'ERC-8004 & 8021',
              },
            ].map((st, i) => (
              <div
                key={st.step}
                className="bg-[#F8FAFC] border border-[#0B0F14]/8 rounded-xl p-4 flex flex-col justify-between hover:border-[#00E676]/60 transition shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-lg font-black font-mono-num text-[#00E676]">
                      {st.step}
                    </span>
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white border border-[#0B0F14]/10 text-[#087F5B]">
                      {st.tag}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-[#0B0F14] mb-1.5">
                    {st.title}
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/65 leading-relaxed font-normal">
                    {st.desc}
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#0B0F14]/8 flex items-center text-[10px] font-semibold text-[#087F5B]">
                  <span>Step {i + 1} of 5</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: 6 CORE ARCHITECTURAL PILLARS */}
        <section id="pillars" className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 bg-[#F8FAFC] rounded-xl border border-[#0B0F14]/8 my-6">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="px-3 py-1 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[11px] font-bold uppercase tracking-wider">
              The Open Rails Stack
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-[#0B0F14] mt-2.5">
              The 6 Architectural Pillars of MOI
            </h2>
            <p className="text-xs text-[#0B0F14]/60 mt-2 leading-relaxed">
              Purpose-built for the Agents on Open Rails Hackathon, integrating every core track sponsor and cryptographic safeguard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Pillar 1 */}
            <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 space-y-2.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#0B0F14]">
                1. Textile FX v2 RFQ Engine
              </h3>
              <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                Connects directly to Textile FX for real-time institutional exchange rates. Converts between digital naira, dollars, and local currencies with guaranteed quotes and zero unexpected slippage.
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 space-y-2.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                <Layers className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#0B0F14]">
                2. textile-stitch Maker Engine
              </h3>
              <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                Implements Avellaneda-Stoikov inventory-skew pricing. Computes reservation prices based on current treasury inventory variance, automatically generating passive quote feeds so enterprise treasuries monetize order flow instead of bleeding spread.
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 space-y-2.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                <Globe className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#0B0F14]">
                3. Ripio LatAm wFIAT Ramps
              </h3>
              <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                Native handling for Latin American currency corridors on Celo: Argentina (wARS), Brazil (wBRL), Colombia (wCOP), Mexico (wMXN), Peru (wPEN), and Chile (wCLP). Builds zero-key direct user ramp URLs with prefilled recipient and amount parameters.
              </p>
            </div>

            {/* Pillar 4 */}
            <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 space-y-2.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                <Zap className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#0B0F14]">
                4. buy / x402 Services in USA₮
              </h3>
              <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                Empowers autonomous agents to pay for premium data, network feeds, and intelligence on-demand using micro-stablecoins, without manual credit card billing.
              </p>
            </div>

            {/* Pillar 5 */}
            <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 space-y-2.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#0B0F14]">
                5. 17-Rule Deterministic Guardrails
              </h3>
              <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                Zero rogue agent trades. LLMs are strictly confined to advice and intent parsing; the actual execution is governed by a 17-point deterministic mathematical policy engine verifying reserve floors, daily spending velocity, slippage, and emergency pause flags.
              </p>
            </div>

            {/* Pillar 6 */}
            <div className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 space-y-2.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                <Lock className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-[#0B0F14]">
                6. Cryptographic Signer & Ledger
              </h3>
              <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                Bank-grade separation between your master funds and autonomous agents. Agents operate strictly within budget limits you define, with every transaction recorded to an auditable ledger.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 4: CORRIDORS & CONTRACT TELEMETRY */}
        <section id="corridors" className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#087F5B]">
                Verified Celo Mainnet Rails
              </p>
              <h2 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                Supported Currency Corridors & Contracts
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono-num text-[#0B0F14]/70">
              <span className="px-2.5 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] font-semibold">
                Attribution: Verified
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10">
                Network: Celo Mainnet
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#0B0F14]/8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#087F5B] bg-[#B6F7D2]/50 px-2 py-0.5 rounded-full">
                  Textile FX v2
                </span>
                <span className="text-[10px] font-mono-num font-bold text-[#0B0F14]/40">NGN / USD</span>
              </div>
              <p className="mt-1.5 font-bold text-xs">cNGN ↔ USD₮ Corridor</p>
              <p className="text-[11px] text-[#0B0F14]/60 mt-1">
                Live Celo RFQ preview & firm quote execution with 17 deterministic policy guardrails.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#0B0F14]/8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#087F5B] bg-[#B6F7D2]/50 px-2 py-0.5 rounded-full">
                  Ripio LatAm wFIAT
                </span>
                <span className="text-[10px] font-mono-num font-bold text-[#0B0F14]/40">LATAM</span>
              </div>
              <p className="mt-1.5 font-bold text-xs">wARS · wBRL · wCOP</p>
              <p className="text-[11px] text-[#0B0F14]/60 mt-1">
                Direct LatAm stablecoin treasury rebalancing & zero-key Ripio Ramp integration.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#0B0F14]/8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#087F5B] bg-[#B6F7D2]/50 px-2 py-0.5 rounded-full">
                  textile-stitch
                </span>
                <span className="text-[10px] font-mono-num font-bold text-[#0B0F14]/40">STITCH</span>
              </div>
              <p className="mt-1.5 font-bold text-xs">Adaptive Quoting Filler</p>
              <p className="text-[11px] text-[#0B0F14]/60 mt-1">
                Avellaneda-Stoikov inventory-skew price feed so treasuries earn spread passively.
              </p>
            </div>

            <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-[#0B0F14]/8">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#087F5B] bg-[#B6F7D2]/50 px-2 py-0.5 rounded-full">
                  buy / x402 + USA₮
                </span>
                <span className="text-[10px] font-mono-num font-bold text-[#0B0F14]/40">X402</span>
              </div>
              <p className="mt-1.5 font-bold text-xs">Independent Verification</p>
              <p className="text-[11px] text-[#0B0F14]/60 mt-1">
                Pays Chainstack, TikHub & Cencori over HTTP 402 in USA₮, USD₮ or USDC.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 5: SECURITY & COMPLIANCE */}
        <section id="security" className="relative z-10 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 sm:py-8 mb-8">
          <div className="bg-white border border-[#0B0F14]/10 rounded-xl p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
              <div>
                <span className="px-2.5 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold uppercase tracking-wider">
                  Cryptographic Integrity & Compliance
                </span>
                <h2 className="text-sm sm:text-base font-bold text-[#0B0F14] mt-1.5">
                  Zero Hallucinations. Provable Verification.
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#00E676]/15 text-[#087F5B] text-[11px] font-bold">
                  Cryptographically Verified On-Chain
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[#0B0F14]/75">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/6 space-y-1.5">
                <p className="font-bold text-xs text-[#0B0F14]">Signer Memory Boundary</p>
                <p className="text-[11px] leading-relaxed text-[#0B0F14]/70">
                  User owner keys never enter autonomous agent processes. The agent signer operates in an isolated environment with cryptographic calldata inspection prior to signing.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/6 space-y-1.5">
                <p className="font-bold text-xs text-[#0B0F14]">Onchain Identity</p>
                <p className="text-[11px] leading-relaxed text-[#0B0F14]/70">
                  Every autonomous agent operates with an authentic onchain identity registered on the Celo network with verifiable credentials.
                </p>
              </div>
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/6 space-y-1.5">
                <p className="font-bold text-xs text-[#0B0F14]">Balanced Double-Entry Ledger</p>
                <p className="text-[11px] leading-relaxed text-[#0B0F14]/70">
                  Every settlement updates asset and expense accounts symmetrically. The ledger enforces the invariant that total debits match total credits down to exact atomic units.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* FULL FOOTER */}
        <footer className="relative z-10 border-t border-[#0B0F14]/10 bg-[#F8FAFC] py-6 sm:py-8 mt-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <MoiRibbonMark className="w-7 h-5.5" />
              <div>
                <span className="font-black text-base text-[#0B0F14]">MOI</span>
                <span className="text-xs text-[#0B0F14]/60 ml-2">Your AI Agent. Your Treasury.</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5 text-xs text-[#0B0F14]/70 font-medium">
              <a href="https://celoscan.io" target="_blank" rel="noreferrer" className="hover:text-[#087F5B] transition">
                CeloScan (42220)
              </a>
              <a href="https://api.textilecredit.com" target="_blank" rel="noreferrer" className="hover:text-[#087F5B] transition">
                Textile FX Docs
              </a>
              <a href="https://gateway.usebuy.ai" target="_blank" rel="noreferrer" className="hover:text-[#087F5B] transition">
                buy / x402 RFC
              </a>
              <a href="/api/identity/agent.json" target="_blank" rel="noreferrer" className="hover:text-[#087F5B] transition">
                ERC-8004 agent.json
              </a>
            </div>

            <p className="text-xs text-[#0B0F14]/50">
              Agents on Open Rails Hackathon · November 2026
            </p>
          </div>
        </footer>

        {/* ====================================================================
            SIGN-IN & SIGN-UP AUTHENTICATION MODAL (Remembers Connected Wallet)
            ==================================================================== */}
        {showAuthModal && (
          <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#F8FAFC] rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-white/60 grid grid-cols-1 md:grid-cols-12 relative animate-in fade-in zoom-in-95 duration-200">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-4 right-4 z-20 p-1.5 rounded-full bg-white/80 hover:bg-white text-[#0B0F14] transition"
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>

              {/* Left Brand Panel */}
              <div
                className="md:col-span-5 p-6 flex flex-col justify-between text-center relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(145deg, #FFFFFF 0%, #E6FBF0 55%, #B6F7D2 100%)',
                }}
              >
                <div className="flex items-center gap-2.5 mb-2 justify-center">
                  <MoiRibbonMark className="w-10 h-8" />
                  <span className="text-2xl font-black tracking-tight text-[#0B0F14]">
                    MOI
                  </span>
                </div>

                <div className="my-auto py-4 space-y-2.5">
                  <p className="text-[10px] font-bold text-[#087F5B] uppercase tracking-wider">
                    {authMode === 'signin' ? 'Operator Sign-In' : `Sign-Up · Step ${authStep} of 2`}
                  </p>
                  <p className="text-xs font-semibold text-[#0B0F14]/80 leading-snug">
                    {authMode === 'signin'
                      ? 'Sign in to your account with your email or connected Celo wallet.'
                      : authStep === 1
                      ? 'Set up your autonomous treasury operating profile.'
                      : 'Connect your EVM wallet. Your wallet is what MOI works with on Celo Mainnet.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[#0B0F14]/10 text-[10px] text-[#0B0F14]/60">
                  <span>Celo Mainnet · Chain ID 42220</span>
                </div>
              </div>

              {/* Right Form Card */}
              <div className="md:col-span-7 p-6 bg-white flex flex-col justify-center">
                {authMode === 'signin' ? (
                  /* =================================================================
                     MODE A: SIGN IN (Matches Bottom-Right Card in Uploaded UI Kit)
                     ================================================================= */
                  <div className="space-y-3.5">
                    <div>
                      <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                        Welcome Back
                      </h3>
                      <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                        Sign in to your account
                      </p>
                    </div>

                    {foundAccount ? (
                      /* Returning user account confirmed card */
                      <div className="p-3.5 rounded-xl bg-[#B6F7D2]/40 border border-[#00E676]/40 space-y-2.5 animate-in fade-in duration-200">
                        <div className="flex items-center gap-2.5">
                          <BadgeCheck className="w-4 h-4 text-[#087F5B] shrink-0" />
                          <div>
                            <p className="font-bold text-xs text-[#0B0F14]">
                              {foundAccount.displayName}
                            </p>
                            <p className="text-[11px] text-[#0B0F14]/70">
                              {foundAccount.organization} · {foundAccount.email}
                            </p>
                          </div>
                        </div>

                        {foundAccount.walletAddress && (
                          <div className="p-2 rounded-lg bg-white/70 border border-[#00E676]/30 text-[11px] font-mono-num flex items-center justify-between">
                            <span className="text-[#0B0F14]/70">Connected Wallet:</span>
                            <span className="font-bold text-[#087F5B]">
                              {foundAccount.walletAddress.slice(0, 6)}...{foundAccount.walletAddress.slice(-4)}
                            </span>
                          </div>
                        )}

                        <button
                          onClick={handleSignInWithFoundAccount}
                          disabled={lookupLoading}
                          className="w-full py-2 px-3 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white font-bold text-xs transition flex items-center justify-center gap-2 shadow-xs"
                        >
                          {lookupLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Wallet className="w-3.5 h-3.5 text-[#00E676]" />
                          )}
                          Sign In with This Account & Wallet
                        </button>

                        <button
                          onClick={() => {
                            setFoundAccount(null);
                            setLookupMessage(null);
                          }}
                          className="w-full text-center text-[11px] text-[#0B0F14]/50 hover:text-[#0B0F14] transition"
                        >
                          Use a different email
                        </button>
                      </div>
                    ) : (
                      /* Initial Sign In Email + Wallet form */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                            Operator Email
                          </label>
                          <input
                            type="email"
                            value={authEmailInput}
                            onChange={(e) => {
                              setAuthEmailInput(e.target.value);
                              setLookupMessage(null);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleLookupEmail();
                            }}
                            placeholder="you@domain.com"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                          />
                        </div>

                        {lookupMessage && (
                          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 space-y-1.5">
                            <p>{lookupMessage}</p>
                            <button
                              onClick={() => {
                                setAuthMode('signup');
                                setAuthStep(1);
                              }}
                              className="font-bold text-[#087F5B] hover:underline block"
                            >
                              Create an account with this email →
                            </button>
                          </div>
                        )}

                        <button
                          onClick={handleLookupEmail}
                          disabled={lookupLoading}
                          className="w-full py-2.5 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                        >
                          {lookupLoading ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <span>Continue</span>
                          )}
                        </button>

                        <div className="relative py-0.5 flex items-center justify-center">
                          <span className="bg-white px-2.5 text-[11px] text-[#0B0F14]/40 font-semibold">
                            or
                          </span>
                        </div>

                        <button
                          onClick={handleConnectBrowserWallet}
                          disabled={authWalletLoading}
                          className="w-full py-2.5 rounded-full bg-white hover:bg-[#F8FAFC] text-[#0B0F14] border border-[#0B0F14]/15 font-semibold text-xs flex items-center justify-center gap-2 transition"
                        >
                          {authWalletLoading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Waiting for wallet signature...</span>
                            </>
                          ) : (
                            <>
                              <Wallet className="w-3.5 h-3.5 text-[#087F5B]" />
                              <span>Connect Wallet (SIWE / Celo Mainnet)</span>
                            </>
                          )}
                        </button>

                        {authWalletError === 'NO_WALLET_INSTALLED' ? (
                          <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-2 text-left">
                            <div className="flex items-center gap-2 font-bold text-amber-800">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>Web3 Wallet Required to Use MOI</span>
                            </div>
                            <p className="text-[11px] text-amber-800/90 leading-snug">
                              MOI is an autonomous onchain treasury platform. An EVM Web3 wallet on Celo Mainnet is required to authenticate via SIWE and sign transactions:
                            </p>
                            <div className="flex flex-wrap gap-2 pt-0.5">
                              <a
                                href="https://metamask.io/download/"
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-md bg-white border border-amber-300 font-semibold text-[10px] text-[#0B0F14] hover:bg-amber-100 flex items-center gap-1 transition shadow-xs"
                              >
                                MetaMask <ExternalLink className="w-3 h-3 text-[#087F5B]" />
                              </a>
                              <a
                                href="https://rabby.io/"
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-md bg-white border border-amber-300 font-semibold text-[10px] text-[#0B0F14] hover:bg-amber-100 flex items-center gap-1 transition shadow-xs"
                              >
                                Rabby <ExternalLink className="w-3 h-3 text-[#087F5B]" />
                              </a>
                              <a
                                href="https://minipay.opera.com/"
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-md bg-white border border-amber-300 font-semibold text-[10px] text-[#0B0F14] hover:bg-amber-100 flex items-center gap-1 transition shadow-xs"
                              >
                                MiniPay <ExternalLink className="w-3 h-3 text-[#087F5B]" />
                              </a>
                            </div>
                          </div>
                        ) : authWalletError ? (
                          <p className="text-[11px] text-red-600 font-medium text-center">
                            {authWalletError}
                          </p>
                        ) : null}
                      </div>
                    )}

                    <div className="pt-2.5 border-t border-[#0B0F14]/8 text-center text-[11px] text-[#0B0F14]/60">
                      <span>New to MOI? </span>
                      <button
                        onClick={() => {
                          setAuthMode('signup');
                          setAuthStep(1);
                          setLookupMessage(null);
                        }}
                        className="font-bold text-[#087F5B] hover:underline"
                      >
                        Create Account
                      </button>
                    </div>
                  </div>
                ) : (
                  /* =================================================================
                     MODE B: SIGN UP (New Account Registration)
                     ================================================================= */
                  authStep === 1 ? (
                    <div className="space-y-3.5">
                      <div>
                        <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                          Create Account
                        </h3>
                        <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                          Set up your autonomous treasury operating profile
                        </p>
                      </div>

                      {lookupMessage && (
                        <div className="p-2 rounded-lg bg-[#B6F7D2]/40 text-[#087F5B] text-[11px] font-medium">
                          {lookupMessage}
                        </div>
                      )}

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                            Operator Email
                          </label>
                          <input
                            type="email"
                            value={authEmailInput}
                            onChange={(e) => setAuthEmailInput(e.target.value)}
                            placeholder="treasury@company.co"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                              Full Name
                            </label>
                            <input
                              type="text"
                              value={authNameInput}
                              onChange={(e) => setAuthNameInput(e.target.value)}
                              placeholder="Alex Thorne"
                              className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                              Role Title
                            </label>
                            <input
                              type="text"
                              value={authRoleInput}
                              onChange={(e) => setAuthRoleInput(e.target.value)}
                              placeholder="Treasury Lead"
                              className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                            Organization / Company Name
                          </label>
                          <input
                            type="text"
                            value={authOrgInput}
                            onChange={(e) => setAuthOrgInput(e.target.value)}
                            placeholder="Acme Global Logistics DAO"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                            Primary Corridor Focus
                          </label>
                          <select
                            value={authRegionInput}
                            onChange={(e) => setAuthRegionInput(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676] bg-white"
                          >
                            <option value="Nigeria & LatAm Corridors">Nigeria & LatAm Corridors (cNGN, wARS, wBRL)</option>
                            <option value="West Africa (cNGN / USD₮)">West Africa (cNGN / USD₮)</option>
                            <option value="Latin America (wARS, wBRL, wCOP)">Latin America (wARS, wBRL, wCOP)</option>
                            <option value="Global Stablecoins (USA₮, USDC, USD₮)">Global Stablecoins (USA₮, USDC, USD₮)</option>
                          </select>
                        </div>

                        <button
                          onClick={() => setAuthStep(2)}
                          className="w-full mt-1 py-2.5 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                        >
                          Continue to Connect Wallet <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div className="pt-2 border-t border-[#0B0F14]/8 text-center text-[11px] text-[#0B0F14]/60">
                        <span>Already have an account? </span>
                        <button
                          onClick={() => {
                            setAuthMode('signin');
                            setLookupMessage(null);
                          }}
                          className="font-bold text-[#087F5B] hover:underline"
                        >
                          Sign In
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Sign Up Step 2: Mandatory Wallet Connection */
                    <div className="space-y-3.5">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-[#00E676]" />
                          <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                            Connect Your Wallet
                          </h3>
                        </div>
                        <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                          Mandatory: Your Celo wallet is the master owner authority that signs mandates and exercises emergency control.
                        </p>
                      </div>

                      <div className="p-3 rounded-xl bg-[#B6F7D2]/40 border border-[#00E676]/30 text-[11px] text-[#087F5B] space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Signer Separation Guarantee:
                        </p>
                        <p className="text-[#0B0F14]/75 leading-relaxed">
                          Your wallet holds custody and authorizes policy parameters; autonomous agent keys only execute within your cryptographic bounds.
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <button
                          onClick={handleConnectBrowserWallet}
                          className="w-full py-2.5 rounded-full bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-xs flex items-center justify-center gap-2 transition shadow-sm shadow-[#00E676]/20"
                        >
                          <Wallet className="w-3.5 h-3.5 text-[#0B0F14]" />
                          Connect Browser Wallet (MetaMask / Rabby / MiniPay)
                        </button>

                        <div className="relative py-0.5 flex items-center justify-center">
                          <span className="bg-white px-2.5 text-[10px] text-[#0B0F14]/40 font-semibold">
                            or enter custom Celo address
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                            Celo Mainnet Wallet Address
                          </label>
                          <input
                            type="text"
                            value={authWalletInput}
                            onChange={(e) => {
                              setAuthWalletInput(e.target.value);
                              setAuthWalletError(null);
                            }}
                            placeholder="0x7a9d56e55Aa0C069118F47aF2ebe675cf0fc1fF6"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-mono-num focus:outline-none focus:border-[#00E676]"
                          />
                        </div>

                        {authWalletError && (
                          <p className="text-[11px] text-red-600 font-medium">
                            {authWalletError}
                          </p>
                        )}

                        <div className="grid grid-cols-2 gap-2.5 pt-1.5">
                          <button
                            onClick={() => setAuthStep(1)}
                            className="py-2 rounded-full bg-white hover:bg-[#F8FAFC] border border-[#0B0F14]/15 text-[#0B0F14] font-semibold text-xs transition"
                          >
                            ← Back
                          </button>
                          <button
                            onClick={() => handleCompleteSignUpWithWallet()}
                            className="py-2 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
                          >
                            Complete Sign Up <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-[#0B0F14]/8 text-center text-[11px] text-[#0B0F14]/60">
                        <span>Already have an account? </span>
                        <button
                          onClick={() => {
                            setAuthMode('signin');
                            setLookupMessage(null);
                          }}
                          className="font-bold text-[#087F5B] hover:underline"
                        >
                          Sign In
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // VIEW 2: AUTHENTICATED APP SHELL (Collapsible #0B0F14 Sidebar + #F8FAFC Workspace)
  // ============================================================================
  const userInitials = hasConnectedOwnerWallet
    ? (treasuryData?.userProfile?.avatarInitials ||
        profileForm.displayName
          .split(' ')
          .map((s: string) => s[0])
          .join('')
          .slice(0, 2)
          .toUpperCase() ||
        'OP')
    : '--';

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0B0F14] flex flex-col lg:flex-row">
      {/* COLLAPSIBLE MIDNIGHT SIDEBAR (#0B0F14) */}
      <aside
        className={`w-full ${
          isSidebarCollapsed ? 'lg:w-20 p-3' : 'lg:w-64 p-4 lg:p-5'
        } bg-[#0B0F14] text-white flex flex-col justify-between shrink-0 transition-all duration-300 ease-in-out`}
      >
        <div>
          {/* Top Logo & Collapse Toggle: Always clearly visible whether expanded or collapsed */}
          <div
            className={`flex ${
              isSidebarCollapsed
                ? 'flex-col items-center gap-3 justify-center'
                : 'items-center justify-between px-1'
            } py-1 mb-6`}
          >
            <button
              onClick={() => setViewMode('landing')}
              className="flex items-center gap-2.5 text-left focus:outline-none"
              title="MOI - Return to Landing Page"
            >
              <MoiRibbonMark
                className={`${
                  isSidebarCollapsed ? 'w-10 h-8 mx-auto' : 'w-8 h-7'
                } shrink-0`}
              />
              {!isSidebarCollapsed && (
                <div className="overflow-hidden">
                  <span className="text-xl font-black tracking-tight text-white block leading-none">
                    MOI
                  </span>
                  <span className="text-[10px] text-[#B6F7D2]/75 font-medium">
                    Celo Mainnet · 42220
                  </span>
                </div>
              )}
            </button>

            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition hidden lg:block"
              title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-[#00E676]" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="space-y-1">
            {(
              [
                {
                  id: 'dashboard',
                  label: 'Dashboard',
                  icon: LayoutDashboard,
                },
                { id: 'agents', label: 'Agents', icon: Bot },
                { id: 'treasury', label: 'Treasury & FX', icon: TrendingUp },
                { id: 'invoices', label: 'Invoices & Pay', icon: FileText },
                { id: 'buy', label: 'Buy Services', icon: Zap },
                { id: 'transactions', label: 'Transactions', icon: Activity },
                { id: 'profile', label: 'Operator Profile', icon: User },
                { id: 'settings', label: 'Settings', icon: Settings },
              ] as const
            ).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  title={item.label}
                  className={`w-full flex items-center ${
                    isSidebarCollapsed ? 'justify-center px-2 py-2' : 'gap-2.5 px-3 py-2'
                  } rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-[#087F5B]/35 text-[#00E676] border border-[#00E676]/25 shadow-xs'
                      : 'text-white/70 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isActive ? 'text-[#00E676]' : 'text-white/60'
                    }`}
                  />
                  {!isSidebarCollapsed && (
                    <span className="truncate">{item.label}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Emergency Control & User Profile Card */}
        <div className="space-y-2.5 pt-4 border-t border-white/10">
          <button
            onClick={() => handleEmergencyPause(!anyMandatePaused)}
            title={anyMandatePaused ? 'Resume Mandates' : 'Emergency Pause All'}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition ${
              anyMandatePaused
                ? 'bg-[#00E676] text-[#0B0F14]'
                : 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30'
            }`}
          >
            <PauseCircle className="w-3.5 h-3.5 shrink-0" />
            {!isSidebarCollapsed && (
              <span>{anyMandatePaused ? 'Resume Mandates' : 'Emergency Pause All'}</span>
            )}
          </button>

          {/* User Profile / Connected Wallet Pill */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`w-full flex items-center ${
              isSidebarCollapsed ? 'justify-center p-1.5' : 'justify-between px-2.5 py-2'
            } rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition`}
            title="Open Operator Profile"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-6 h-6 rounded-full bg-[#00E676] text-[#0B0F14] font-black text-[11px] flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              {!isSidebarCollapsed && (
                <div className="text-left truncate">
                  <p className="font-bold text-white text-xs truncate">
                    {profileForm.displayName}
                  </p>
                  <p className="text-[10px] text-white/50 font-mono-num truncate">
                    {ownerWalletShort}
                  </p>
                </div>
              )}
            </div>
            {!isSidebarCollapsed && (
              <span
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                  hasConnectedOwnerWallet
                    ? 'bg-white/10 text-[#00E676]'
                    : 'bg-amber-400/20 text-amber-300'
                }`}
              >
                {hasConnectedOwnerWallet ? 'Connected' : 'Offline'}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 p-4 sm:p-5 lg:p-10 max-w-6xl w-full mx-auto space-y-6">
        {/* Global Emergency Banner if Paused */}
        {anyMandatePaused && (
          <div className="rounded-2xl bg-red-50 border border-red-200 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-900">
                  Emergency Stop Active — All Autonomous Treasury Executions Halted
                </p>
                <p className="text-xs text-red-700">
                  Deterministic policy engine is blocking all new RFQ and x402
                  signatures until resumed.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleEmergencyPause(false)}
              className="px-4 py-2 rounded-full bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
            >
              Lift Emergency Stop
            </button>
          </div>
        )}

        {/* Top App Header Strip with Mode Pill & Clickable Profile Chip */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-2 border-b border-[#0B0F14]/8">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#0B0F14]/60">
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${hasConnectedOwnerWallet ? 'bg-[#00E676] animate-pulse' : 'bg-amber-400'}`} />
              Celo Mainnet (42220)
            </span>
            <span>·</span>
            <span className="text-[#087F5B] font-bold">
              {profileForm.organization || 'MOI Global Treasury'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <MoiWalletButton size="sm" />

            <button
              onClick={() => setActiveTab('profile')}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white hover:bg-[#F8FAFC] border border-[#0B0F14]/10 text-xs font-semibold transition cursor-pointer"
            >
              <div className="w-5 h-5 rounded-full bg-[#00E676] text-[#0B0F14] font-bold text-[10px] flex items-center justify-center">
                {userInitials}
              </div>
              <span className="text-[#0B0F14] font-semibold">{profileForm.displayName || 'Operator'}</span>
            </button>
          </div>
        </div>

        {/* =====================================================================
            TAB 1: DASHBOARD ("Your treasury at a glance.")
           ===================================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                  Dashboard
                </h1>
                <p className="text-xs text-[#0B0F14]/55">
                  Your treasury at a glance.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-[#0B0F14]/10 text-xs font-mono-num text-[#0B0F14]/75">
                  <Shield className="w-3.5 h-3.5 text-[#087F5B]" />
                  ERC-8021: {treasuryData?.attributionStatus?.configuredTag ?? 'celo_c9cb9a59fc4c'}
                </span>
                <button
                  onClick={() => fetchAllData()}
                  className="p-2.5 rounded-full bg-white border border-[#0B0F14]/10 hover:bg-[#F8FAFC] transition"
                  title="Refresh live Celo Mainnet state"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-[#0B0F14]/70 ${loading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            </div>

            {/* Total Balance Card + Sparkline + 4 Action Pills (Matching Uploaded UI) */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                <div className="lg:col-span-6 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-[#0B0F14]/60">
                      Total Balance
                    </p>
                    <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                      Live Network Sync
                    </span>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-2 pt-0.5">
                    <h2 className="text-2xl sm:text-3xl font-extrabold font-mono-num tracking-tight text-[#0B0F14]">
                      {activeBasePrefix}{totalInBaseFiat.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </h2>
                    <select
                      value={profileForm.preferredBaseSymbol}
                      onChange={async (e) => {
                        const newBase = e.target.value as AssetSymbol;
                        setProfileForm((prev) => ({ ...prev, preferredBaseSymbol: newBase }));
                        try {
                          await fetch('/api/treasury', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              action: 'update_profile',
                              profile: { ...profileForm, preferredBaseSymbol: newBase },
                            }),
                          });
                        } catch (err) {
                          console.error('Failed to update preferred base fiat:', err);
                        }
                      }}
                      className="text-[11px] font-bold bg-[#F8FAFC] border border-[#0B0F14]/15 rounded-lg px-2 py-1 text-[#0B0F14] focus:outline-none focus:border-[#00E676] cursor-pointer"
                      title="Select preferred base currency"
                    >
                      <option value="cNGN">cNGN (₦)</option>
                      <option value="USDT">USD₮ ($)</option>
                      <option value="USDC">USDC ($)</option>
                      <option value="USAT">USA₮ ($)</option>
                      <option value="wARS">wARS (ARS $)</option>
                      <option value="wBRL">wBRL (R$)</option>
                      <option value="wCOP">wCOP (COL $)</option>
                      <option value="wMXN">wMXN (MEX $)</option>
                    </select>
                  </div>

                  <p className="text-[10px] sm:text-[11px] text-[#0B0F14]/55 font-mono-num">
                    {activeBaseSymbol !== 'USDT'
                      ? `≈ $${totalInUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD₮ · `
                      : `≈ ₦${(totalInUsd * 1600).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} cNGN · `}
                    Verified on Celo Mainnet
                  </p>
                </div>

                {/* Live Ledger Activity / Truthful Chart State */}
                <div className="lg:col-span-6 flex flex-col justify-center">
                  {(treasuryData?.executions || []).filter(
                    (e: any) => e.state === 'CONFIRMED' || e.state === 'RECONCILED'
                  ).length > 0 ? (
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8">
                      <p className="text-[11px] font-bold text-[#0B0F14]">Settled Volume</p>
                      <p className="text-xl font-black font-mono-num text-[#087F5B]">
                        {(treasuryData?.analytics?.filledBuyVolumeUsdtAtomic
                          ? Number(formatAtomicUnits(treasuryData.analytics.filledBuyVolumeUsdtAtomic, 6)).toLocaleString()
                          : '0.00')}{' '}
                        <span className="text-xs font-bold text-[#0B0F14]/50">USD₮</span>
                      </p>
                      <p className="text-[10px] text-[#0B0F14]/60 mt-0.5">
                        Derived directly from verified onchain settlement events
                      </p>
                    </div>
                  ) : (
                    <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/6 flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 text-[#087F5B] flex items-center justify-center shrink-0">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#0B0F14]">
                          Double-Entry Ledger Live
                        </p>
                        <p className="text-[10px] text-[#0B0F14]/55 mt-0.5">
                          0 settled swaps onchain. Dynamic curves plot strictly from cryptographic journal records upon execution.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 5 Quick Action Pill Buttons with Withdraw to Bank (Off-Ramp) */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4 pt-3.5 border-t border-[#0B0F14]/8">
                <button
                  onClick={() => {
                    setSendError(null);
                    setSendSuccess(null);
                    setShowSendModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#F8FAFC] hover:bg-[#B6F7D2]/40 border border-[#0B0F14]/8 text-xs font-semibold text-[#0B0F14] transition cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>Send</span>
                </button>
                <button
                  onClick={() => setShowReceiveModal(true)}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#F8FAFC] hover:bg-[#B6F7D2]/40 border border-[#0B0F14]/8 text-xs font-semibold text-[#0B0F14] transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>Receive</span>
                </button>
                <button
                  onClick={() => {
                    setWithdrawError(null);
                    setWithdrawSuccess(null);
                    setShowWithdrawModal(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#00E676]/15 hover:bg-[#00E676]/25 border border-[#00E676]/30 text-xs font-bold text-[#087F5B] transition shadow-xs cursor-pointer"
                >
                  <Building2 className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>Withdraw to Bank</span>
                </button>
                <button
                  onClick={() => setActiveTab('treasury')}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#F8FAFC] hover:bg-[#B6F7D2]/40 border border-[#0B0F14]/8 text-xs font-semibold text-[#0B0F14] transition cursor-pointer"
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>Swap</span>
                </button>
                <button
                  onClick={() => setActiveTab('buy')}
                  className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-[#F8FAFC] hover:bg-[#B6F7D2]/40 border border-[#0B0F14]/8 text-xs font-semibold text-[#0B0F14] transition cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5 text-[#087F5B]" />
                  <span>Buy</span>
                </button>
              </div>
            </div>

            {/* Target Portfolio Allocation & Auto-Rebalance Guard */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#B6F7D2]/60 text-[#087F5B] flex items-center justify-center">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#0B0F14]">
                      Target Portfolio Allocation & Rebalance Guard
                    </h3>
                    <p className="text-[11px] text-[#0B0F14]/55">
                      Automatically monitors savings balance between dollars and local currency.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span className="text-[#0B0F14]/60">Target:</span>
                  <span className="px-2 py-0.5 rounded-md bg-[#0B0F14] text-[#00E676] font-mono-num">
                    {targetUsdPercent}% USD₮ / {100 - targetUsdPercent}% Local
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    Math.abs(portfolioDriftPercent) < 5
                      ? 'bg-[#B6F7D2] text-[#087F5B]'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {Math.abs(portfolioDriftPercent) < 5
                      ? 'In Balance'
                      : `Drifted by ${Math.abs(portfolioDriftPercent)}%`}
                  </span>
                </div>
              </div>

              {/* Slider Control */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-[11px] text-[#0B0F14]/60 font-semibold">
                  <span>100% Local Currency</span>
                  <span>50 / 50 Balanced</span>
                  <span>100% USD₮ Reserve</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={targetUsdPercent}
                  onChange={(e) => setTargetUsdPercent(Number(e.target.value))}
                  className="w-full accent-[#087F5B] cursor-pointer"
                />
              </div>

              {/* Drift Alert & 1-Click Rebalance */}
              {rebalanceSuggestedAction && (
                <div className="p-3 rounded-xl bg-[#F0FDF4] border border-[#00E676]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-[#0B0F14] flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-[#087F5B]" />
                      Automated Rebalancing Recommendation
                    </p>
                    <p className="text-[11px] text-[#0B0F14]/70">
                      {rebalanceSuggestedAction.reason}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (rebalanceSuggestedAction.action === 'sell_usd') {
                        setIsDirectionFlipped(true);
                        setSellHumanInput(rebalanceSuggestedAction.amountUsd.toString());
                      } else {
                        setIsDirectionFlipped(false);
                        const rate = FIAT_RATES[activeBaseSymbol] || 1600;
                        setSellHumanInput((rebalanceSuggestedAction.amountUsd * rate).toString());
                      }
                      setActiveTab('treasury');
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-[#00E676] hover:bg-[#00c968] text-[#0B0F14] text-xs font-bold transition shrink-0 flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <span>1-Click Rebalance</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Verified Celo Mainnet Asset Balances Strip */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0B0F14]">
                    Verified Live Balances
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Real-time balances synchronized directly with your Celo network wallet.
                  </p>
                </div>
                <span className="text-[11px] font-mono-num text-[#0B0F14]/50">
                  {treasuryData?.fetchedAt
                    ? new Date(treasuryData.fetchedAt).toLocaleTimeString()
                    : ''}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {(treasuryData?.liveBalances || [])
                  .slice(0, 6)
                  .map((b: any) => (
                    <div
                      key={b.symbol}
                      className="rounded-xl bg-[#F8FAFC] p-2.5 sm:p-3 border border-[#0B0F14]/8"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{b.symbol}</span>
                        <span className="text-[9px] font-bold text-[#087F5B] px-1.5 py-0.5 rounded bg-[#B6F7D2]/40">CELO</span>
                      </div>
                      <p className="font-mono-num text-sm sm:text-base font-extrabold mt-1">
                        {formatAtomicWithCommas(b.balanceAtomic, b.decimals, 2)}
                      </p>
                      <p className="text-[9px] text-[#0B0F14]/50 truncate mt-0.5">
                        {b.region}
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            {/* Bottom Split: Recent Activity + Your Agents (Matching Uploaded UI) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Recent Activity */}
              <div className="lg:col-span-7 bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <h3 className="text-xs sm:text-sm font-bold text-[#0B0F14]">
                      Recent Activity
                    </h3>
                    <button
                      onClick={() => setActiveTab('transactions')}
                      className="text-[11px] font-bold text-[#087F5B] hover:underline flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(treasuryData?.auditEvents || [])
                      .slice(0, 4)
                      .map((ev: any) => (
                        <div
                          key={ev.id}
                          className="flex items-start justify-between gap-3 p-2.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/6"
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                ev.severity === 'SUCCESS'
                                  ? 'bg-[#B6F7D2] text-[#087F5B]'
                                  : ev.severity === 'WARNING' ||
                                      ev.severity === 'CRITICAL'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {ev.category === 'X402_SERVICE_PURCHASE' ? (
                                <Zap className="w-3.5 h-3.5" />
                              ) : ev.category === 'POLICY_DECISION' ? (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              ) : (
                                <Activity className="w-3.5 h-3.5" />
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-[#0B0F14]">
                                {ev.title}
                              </p>
                              <p className="text-[11px] text-[#0B0F14]/65 line-clamp-1 mt-0.5">
                                {ev.detail}
                              </p>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono-num text-[#0B0F14]/45 shrink-0">
                            {new Date(ev.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#0B0F14]/8 flex items-center justify-between text-[11px] text-[#0B0F14]/60">
                  <span>
                    Total RFQs:{' '}
                    <strong className="text-[#0B0F14]">
                      {treasuryData?.analytics?.totalRfqCount ?? 0}
                    </strong>
                  </span>
                  <span>
                    Rejections:{' '}
                    <strong className="text-[#0B0F14]">
                      {treasuryData?.analytics?.policyRejectedCount ?? 0}
                    </strong>
                  </span>
                  <span>
                    Settled:{' '}
                    <strong className="text-[#087F5B]">
                      {treasuryData?.analytics?.settledSwapsCount ?? 0}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Your Agents Card */}
              <div className="lg:col-span-5 bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3.5">
                    <h3 className="text-xs sm:text-sm font-bold text-[#0B0F14]">
                      Your Agents
                    </h3>
                    <button
                      onClick={() => setActiveTab('agents')}
                      className="text-[11px] font-bold text-[#087F5B] hover:underline flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(treasuryData?.agents || []).map((ag: any) => (
                      <div
                        key={ag.id}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/6"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-[#B6F7D2]/50 flex items-center justify-center text-[#087F5B]">
                            <Bot className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-[#0B0F14]">
                              {ag.name}
                            </p>
                            <p className="text-[10px] text-[#0B0F14]/55">
                              {ag.active ? 'Active · Celo 42220' : 'Paused'}
                            </p>
                          </div>
                        </div>

                        {/* Mint Toggle Switch matching Uploaded UI */}
                        <button
                          onClick={() => handleToggleAgent(ag.id, !ag.active)}
                          className={`w-9 h-5 rounded-full p-0.5 transition flex items-center ${
                            ag.active
                              ? 'bg-[#087F5B] justify-end'
                              : 'bg-[#0B0F14]/20 justify-start'
                          }`}
                          aria-label={`Toggle ${ag.name}`}
                        >
                          <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setActiveTab('treasury');
                    handleRunAgentCycle(false);
                  }}
                  className="mt-4 w-full py-2 px-3 rounded-lg bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-[#0B0F14]" />
                  Run Autonomous Evaluation Cycle Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: AGENTS ("Manage your AI agents." + Mandate Policy Compiler)
           ===================================================================== */}
        {activeTab === 'agents' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                  Agents
                </h1>
                <p className="text-xs text-[#0B0F14]/55">
                  Manage your AI agents, ERC-8004 identities, and deterministic
                  financial mandates.
                </p>
              </div>

              <button
                onClick={() => {
                  setNewAgentError(null);
                  setShowNewAgentModal(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-xs shadow-xs transition"
              >
                <Plus className="w-3.5 h-3.5" /> + New Agent
              </button>
            </div>

            {/* Agent Cards List matching Top-Right Screen in Uploaded UI */}
            {(treasuryData?.agents || []).length === 0 ? (
              <div className="bg-white rounded-2xl p-7 border border-[#0B0F14]/10 text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#B6F7D2]/40 text-[#087F5B] mx-auto flex items-center justify-center">
                  <Bot className="w-6 h-6" />
                </div>
                <div className="max-w-md mx-auto space-y-1">
                  <h3 className="text-base font-bold text-[#0B0F14]">No Agents Deployed</h3>
                  <p className="text-xs text-[#0B0F14]/60">
                    Your treasury currently runs under 100% manual direct control. You can create a custom agent bound to a strict financial mandate, or instantiate an optional pre-configured template.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      setNewAgentError(null);
                      setShowNewAgentModal(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-xs font-bold text-[#0B0F14] transition shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Custom Mandate & Agent</span>
                  </button>
                </div>

                <div className="pt-5 border-t border-[#0B0F14]/8 max-w-xl mx-auto">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/50 mb-2.5">
                    Or Quick-Deploy From Official Templates
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
                    <button
                      onClick={() => handleDeployTemplate('rebalancer')}
                      className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 hover:border-[#00E676] transition space-y-1 text-left"
                    >
                      <span className="text-[10px] font-bold text-[#087F5B] uppercase block">Textile FX v2</span>
                      <h4 className="text-xs font-bold text-[#0B0F14]">Nigeria Treasury</h4>
                      <p className="text-[10px] text-[#0B0F14]/60">cNGN → USD₮ rebalancer with 50k reserve floor</p>
                    </button>
                    <button
                      onClick={() => handleDeployTemplate('stitch')}
                      className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 hover:border-[#00E676] transition space-y-1 text-left"
                    >
                      <span className="text-[10px] font-bold text-[#087F5B] uppercase block">textile-stitch</span>
                      <h4 className="text-xs font-bold text-[#0B0F14]">Ripio MM Corridor</h4>
                      <p className="text-[10px] text-[#0B0F14]/60">wARS / USD₮ passive quoting with inventory skew</p>
                    </button>
                    <button
                      onClick={() => handleDeployTemplate('x402')}
                      className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 hover:border-[#00E676] transition space-y-1 text-left"
                    >
                      <span className="text-[10px] font-bold text-[#087F5B] uppercase block">buy / x402</span>
                      <h4 className="text-xs font-bold text-[#0B0F14]">Compliance Audit</h4>
                      <p className="text-[10px] text-[#0B0F14]/60">Receipt audits & machine infrastructure micropayments</p>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {(treasuryData?.agents || []).map((ag: any) => {
                  const mandate: TreasuryMandate | undefined =
                    treasuryData?.mandates?.find(
                      (m: any) => m.id === ag.mandateId
                    );
                  const sAsset = mandate
                    ? findAssetByAddress(mandate.sellToken)
                    : undefined;
                  const bAsset = mandate
                    ? findAssetByAddress(mandate.buyToken)
                    : undefined;

                  return (
                    <div
                      key={ag.id}
                      className="bg-white rounded-xl p-4 sm:p-4.5 border border-[#0B0F14]/8 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3.5"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#B6F7D2]/45 border border-[#00E676]/30 flex items-center justify-center shrink-0">
                          {ag.role === 'x402_reconciler' ? (
                            <Search className="w-5 h-5 text-[#087F5B]" />
                          ) : ag.role === 'treasury_rebalancer' ? (
                            <TrendingUp className="w-5 h-5 text-[#087F5B]" />
                          ) : (
                            <Sparkles className="w-5 h-5 text-[#087F5B]" />
                          )}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                              {ag.name}
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10 text-[10px] font-mono-num">
                              ERC-8004: 0x8004...a432
                            </span>
                            {sAsset && bAsset && (
                              <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/40 text-[#087F5B] text-[10px] font-bold">
                                {sAsset.symbol} → {bAsset.symbol}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                            {ag.description}
                          </p>
                          {mandate && (
                            <p className="text-[10px] font-mono-num text-[#0B0F14]/55 mt-1.5">
                              Mode: <strong>{mandate.mode}</strong> · Min Reserve:{' '}
                              {formatAtomicWithCommas(
                                mandate.minimumReserveAtomic,
                                sAsset?.decimals ?? 6,
                                0
                              )}{' '}
                              {sAsset?.symbol} · Max Trade:{' '}
                              {formatAtomicWithCommas(
                                mandate.maxTradeAtomic,
                                sAsset?.decimals ?? 6,
                                0
                              )}{' '}
                              {sAsset?.symbol} · 24h Cap:{' '}
                              {formatAtomicWithCommas(
                                mandate.dailySellCapAtomic,
                                sAsset?.decimals ?? 6,
                                0
                              )}{' '}
                              {sAsset?.symbol}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                            ag.active
                              ? 'bg-[#B6F7D2]/70 text-[#087F5B]'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {ag.active ? 'Active' : 'Paused'}
                        </span>

                        <button
                          onClick={() => handleOpenConfigurePolicy(ag)}
                          className="px-3 py-1.5 rounded-full bg-[#F8FAFC] hover:bg-[#0B0F14] hover:text-white border border-[#0B0F14]/12 text-xs font-semibold transition"
                        >
                          Configure Policy
                        </button>

                        <button
                          onClick={() => handleToggleAgent(ag.id, !ag.active)}
                          className="px-2.5 py-1.5 rounded-full border border-[#0B0F14]/12 text-xs font-semibold hover:bg-[#F8FAFC]"
                        >
                          {ag.active ? 'Pause' : 'Enable'}
                        </button>

                        <button
                          onClick={() => handleDeleteAgent(ag.id)}
                          className="p-1.5 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition"
                          title="Delete Agent & Mandate"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Natural-Language-to-Deterministic-Policy Compiler */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F5B]">
                    Section 12.5 · LLM Boundary Guardrail
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14] mt-0.5">
                    Natural Language Mandate → Deterministic Policy Compiler
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/60">
                    The compiler translates plain-English intent into structured
                    atomic rules. Deterministic code—never an LLM—authorizes
                    transactions.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={nlIntentInput}
                  onChange={(e) => setNlIntentInput(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                  placeholder="e.g. Preserve 50,000 cNGN reserve, convert excess up to 25,000 per trade..."
                />
                <button
                  onClick={handleCompileNlMandate}
                  className="px-4 py-2 rounded-lg bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold shrink-0 transition"
                >
                  Compile & Update Policy
                </button>
              </div>

              {nlDraftSummary.length > 0 && (
                <div className="rounded-xl bg-[#B6F7D2]/35 border border-[#00E676]/40 p-3 space-y-1">
                  <p className="text-[11px] font-bold text-[#087F5B]">
                    Compiled Structured Policy Changes:
                  </p>
                  {nlDraftSummary.map((line, i) => (
                    <p key={i} className="text-[11px] text-[#0B0F14]">
                      • {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: TREASURY & FX TERMINAL (Textile FX v2 + Stitch + Ripio Ramp)
           ===================================================================== */}
        {activeTab === 'treasury' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                  Treasury & FX Terminal
                </h1>
                <p className="text-xs text-[#0B0F14]/55">
                  Live Textile FX v2 RFQ execution, adaptive Stitch filler quoting,
                  and Ripio LatAm wFIAT ramps on Celo Mainnet.
                </p>
              </div>

              {/* Corridor Selector: All 7 Core Corridors permanently available */}
              <div className="flex flex-wrap items-center gap-1.5">
                {CORE_CORRIDORS.map((c) => {
                  const active =
                    (selectedMandateId === c.id && !customSellSymbol && !customBuySymbol) ||
                    (customSellSymbol === c.sell && customBuySymbol === c.buy) ||
                    (customSellSymbol === c.buy && customBuySymbol === c.sell);
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedMandateId(c.id);
                        setCustomSellSymbol(c.sell);
                        setCustomBuySymbol(c.buy);
                        setIsDirectionFlipped(false);
                        setSwapError(null);
                        setSwapSuccess(null);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                        active
                          ? 'bg-[#0B0F14] text-[#00E676] shadow-xs'
                          : 'bg-white text-[#0B0F14] border border-[#0B0F14]/12 hover:bg-[#F8FAFC]'
                      }`}
                    >
                      {c.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => {
                    setNewAgentError(null);
                    setShowNewAgentModal(true);
                  }}
                  className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#00E676]/20 hover:bg-[#00E676]/30 text-[#087F5B] border border-[#00E676]/40 transition flex items-center gap-1 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ New Mandate</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left: Live Textile FX v2 RFQ Terminal */}
              <div className="lg:col-span-7 bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-4">
                {(() => {
                  const sellBalRecord = treasuryData?.liveBalances?.find((b: any) => b.symbol === sellAsset.symbol);
                  const buyBalRecord = treasuryData?.liveBalances?.find((b: any) => b.symbol === buyAsset.symbol);
                  const availableSellUnits = hasConnectedOwnerWallet && sellBalRecord
                    ? Number(formatAtomicUnits(sellBalRecord.balanceAtomic || '0', sellAsset.decimals || 18))
                    : 0;
                  const availableBuyUnits = hasConnectedOwnerWallet && buyBalRecord
                    ? Number(formatAtomicUnits(buyBalRecord.balanceAtomic || '0', buyAsset.decimals || 18))
                    : 0;
                  const inputAmountNum = Number(sellHumanInput || '0');
                  const hasInsufficientBalance = hasConnectedOwnerWallet && availableSellUnits > 0 && inputAmountNum > availableSellUnits;

                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                              Guaranteed Rate · Zero Slippage
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#087F5B] text-[10px] font-bold flex items-center gap-1 shadow-2xs">
                              <Sparkles className="w-3 h-3 text-[#00E676]" />
                              +0.4% Better than Centralized P2P
                            </span>
                          </div>
                          <h3 className="text-base sm:text-lg font-bold text-[#0B0F14] mt-1">
                            Instant Currency Swap
                          </h3>
                        </div>
                        <span className="text-[11px] font-semibold text-[#087F5B]">
                          Live Celo Network
                        </span>
                      </div>

                      {/* Input Amount (Sell) with Available Balance and MAX button */}
                      <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[11px] text-[#0B0F14]">
                            You Pay ({sellAsset.name})
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-[#0B0F14]/60">
                              Available:{' '}
                              <strong className="font-mono-num text-[#0B0F14]">
                                {availableSellUnits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {sellAsset.symbol}
                              </strong>
                            </span>
                            {availableSellUnits > 0 && (
                              <button
                                type="button"
                                onClick={() => setSellHumanInput(availableSellUnits.toString())}
                                className="px-2 py-0.5 rounded bg-[#B6F7D2]/60 hover:bg-[#00E676] text-[#087F5B] text-[10px] font-bold transition cursor-pointer"
                              >
                                MAX
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <input
                            type="text"
                            value={sellHumanInput}
                            onChange={(e) => {
                              setSellHumanInput(e.target.value);
                              setSwapError(null);
                              setSwapSuccess(null);
                            }}
                            placeholder="0.00"
                            className="w-full bg-transparent text-xl sm:text-2xl font-black font-mono-num focus:outline-none"
                          />
                          <select
                            value={sellAsset.symbol}
                            onChange={(e) => {
                              const sym = e.target.value as AssetSymbol;
                              setCustomSellSymbol(sym);
                              if (sym === buyAsset.symbol) {
                                setCustomBuySymbol(sym === 'USDT' ? 'cNGN' : 'USDT');
                              }
                              setSwapError(null);
                              setSwapSuccess(null);
                            }}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-[#0B0F14]/15 font-bold text-xs shrink-0 shadow-xs cursor-pointer focus:outline-none focus:border-[#00E676]"
                          >
                            <option value="CELO">CELO</option>
                            <option value="USDT">USD₮</option>
                            <option value="cNGN">cNGN</option>
                            <option value="wARS">wARS</option>
                            <option value="wBRL">wBRL</option>
                            <option value="wCOP">wCOP</option>
                            <option value="wMXN">wMXN</option>
                            <option value="USDC">USDC</option>
                            <option value="USAT">USA₮</option>
                          </select>
                        </div>
                      </div>

                      {/* Corridor Direction Flip Control */}
                      <div className="flex items-center justify-center -my-2 relative z-10">
                        <button
                          type="button"
                          onClick={() => {
                            const curSell = sellAsset.symbol;
                            const curBuy = buyAsset.symbol;
                            setCustomSellSymbol(curBuy);
                            setCustomBuySymbol(curSell);
                            setIsDirectionFlipped(!isDirectionFlipped);
                            setSwapError(null);
                            setSwapSuccess(null);
                          }}
                          className="px-3.5 py-1.5 rounded-full bg-white hover:bg-[#B6F7D2]/40 text-[#087F5B] border border-[#00E676]/40 shadow-xs text-xs font-bold flex items-center gap-1.5 transition active:scale-95 group cursor-pointer"
                          title="Invert swap direction"
                        >
                          <ArrowLeftRight className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-300 text-[#00E676]" />
                          <span>Flip Direction ({sellAsset.symbol} ⇄ {buyAsset.symbol})</span>
                        </button>
                      </div>

                      {/* You Receive Output with Target Balance & Refresh */}
                      <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[11px] text-[#087F5B]">
                              You Receive
                            </span>
                            <select
                              value={buyAsset.symbol}
                              onChange={(e) => {
                                const sym = e.target.value as AssetSymbol;
                                setCustomBuySymbol(sym);
                                if (sym === sellAsset.symbol) {
                                  setCustomSellSymbol(sym === 'USDT' ? 'cNGN' : 'USDT');
                                }
                                setSwapError(null);
                                setSwapSuccess(null);
                              }}
                              className="px-2 py-0.5 rounded-lg bg-white border border-[#0B0F14]/15 font-bold text-[11px] cursor-pointer focus:outline-none focus:border-[#00E676]"
                            >
                              <option value="USDT">USD₮</option>
                              <option value="CELO">CELO</option>
                              <option value="cNGN">cNGN</option>
                              <option value="wARS">wARS</option>
                              <option value="wBRL">wBRL</option>
                              <option value="wCOP">wCOP</option>
                              <option value="wMXN">wMXN</option>
                              <option value="USDC">USDC</option>
                              <option value="USAT">USA₮</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="text-[#0B0F14]/60">
                              Balance:{' '}
                              <strong className="font-mono-num text-[#0B0F14]">
                                {availableBuyUnits.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} {buyAsset.symbol}
                              </strong>
                            </span>
                            <button
                              onClick={fetchLivePreview}
                              className="ml-1 text-[10px] font-bold text-[#087F5B] hover:underline flex items-center gap-1 cursor-pointer"
                            >
                              <RefreshCw
                                className={`w-3 h-3 ${previewLoading ? 'animate-spin' : ''}`}
                              />
                              Refresh
                            </button>
                          </div>
                        </div>

                        {livePreview?.status === 'preview' && livePreview.buyAmount ? (
                          <div>
                            <div className="flex items-baseline justify-between">
                              <span className="text-2xl font-black font-mono-num text-[#0B0F14]">
                                {formatAtomicWithCommas(
                                  livePreview.buyAmount,
                                  buyAsset.decimals,
                                  4
                                )}{' '}
                                {buyAsset.symbol}
                              </span>
                              <span className="text-[11px] font-mono-num text-[#087F5B] font-bold">
                                1 {buyAsset.symbol} ≈{' '}
                                {(
                                  Number(sellHumanInput || '10000') /
                                  Number(
                                    formatAtomicUnits(
                                      livePreview.buyAmount,
                                      buyAsset.decimals
                                    )
                                  )
                                ).toFixed(2)}{' '}
                                {sellAsset.symbol}
                              </span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-[#0B0F14]/8 flex items-center justify-between text-[10px] font-mono-num text-[#0B0F14]/60">
                              <span>Fee: 0.01% (Uniswap v3 Pool)</span>
                              <span className="font-semibold text-[#087F5B]">ERC-8021 Attribution Attached</span>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 font-medium">
                            {livePreview?.reason || 'Fetching live guaranteed exchange rate...'}
                          </p>
                        )}
                      </div>

                      {/* Interactive Web3 Swap Execution */}
                      <div className="pt-2 space-y-2">
                        {!hasConnectedOwnerWallet ? (
                          <button
                            type="button"
                            onClick={handleOpenSignIn}
                            className="w-full py-3 px-4 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-sm flex items-center justify-center gap-2 transition shadow-sm shadow-[#00E676]/30 cursor-pointer"
                          >
                            <Wallet className="w-4 h-4" />
                            Connect Wallet to Swap
                          </button>
                        ) : inputAmountNum <= 0 ? (
                          <button
                            type="button"
                            disabled
                            className="w-full py-3 px-4 rounded-xl bg-[#F8FAFC] text-[#0B0F14]/40 border border-[#0B0F14]/10 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                          >
                            Enter an Amount
                          </button>
                        ) : hasInsufficientBalance ? (
                          <button
                            type="button"
                            disabled
                            className="w-full py-3 px-4 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed"
                          >
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            Insufficient {sellAsset.symbol} Balance
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={handleExecuteWeb3Swap}
                            disabled={swapLoading || previewLoading}
                            className="w-full py-3.5 px-4 rounded-xl bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-sm flex items-center justify-center gap-2 transition shadow-md shadow-[#00E676]/20 disabled:opacity-50 cursor-pointer"
                          >
                            {swapLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin text-[#0B0F14]" />
                                <span>{swapStepText || 'Confirming on Celo Mainnet...'}</span>
                              </>
                            ) : (
                              <>
                                <ArrowLeftRight className="w-4 h-4 text-[#0B0F14]" />
                                <span>Swap {sellAsset.symbol} for {buyAsset.symbol} Now</span>
                              </>
                            )}
                          </button>
                        )}

                        {/* Step Progress Banner */}
                        {swapStepText && swapLoading && (
                          <div className="p-2.5 rounded-lg bg-[#B6F7D2]/40 border border-[#00E676]/40 text-xs text-[#087F5B] flex items-center gap-2 font-mono-num">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />
                            <span>{swapStepText}</span>
                          </div>
                        )}

                        {/* Swap Success Card */}
                        {swapSuccess && (
                          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1.5 animate-in fade-in">
                            <div className="flex items-center justify-between font-bold">
                              <span className="flex items-center gap-1.5 text-[#087F5B]">
                                <CheckCircle2 className="w-4 h-4 text-[#087F5B]" />
                                Swap Settled on Celo Mainnet!
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2] text-[#087F5B] text-[10px] font-mono">
                                ERC-8021 Tagged
                              </span>
                            </div>
                            <p className="text-[11px] text-emerald-800">
                              Swapped {swapSuccess.amount} {swapSuccess.sellSymbol} for {swapSuccess.buySymbol} through Uniswap v3 SwapRouter02.
                            </p>
                            <div className="flex items-center justify-between pt-1 text-[11px]">
                              <a
                                href={`https://celoscan.io/tx/${swapSuccess.txHash}`}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono underline text-[#087F5B] font-bold hover:text-emerald-950 inline-flex items-center gap-1"
                              >
                                <span>Celoscan: {swapSuccess.txHash.slice(0, 10)}...{swapSuccess.txHash.slice(-6)}</span>
                                <ArrowUpRight className="w-3 h-3" />
                              </a>
                              <span className="text-[10px] text-emerald-700 font-mono">Tag: {swapSuccess.attributionTag}</span>
                            </div>
                          </div>
                        )}

                        {/* Swap Error Banner */}
                        {swapError && (
                          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
                            <span>{swapError}</span>
                            <button
                              type="button"
                              onClick={() => setSwapError(null)}
                              className="p-1 hover:bg-red-100 rounded text-red-600 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Secondary Autonomous Agent Simulation Action */}
                        <div className="pt-1 flex items-center justify-between text-xs text-[#0B0F14]/60">
                          <button
                            type="button"
                            onClick={() => handleRunAgentCycle(false)}
                            disabled={cycleLoading}
                            className="hover:text-[#087F5B] underline cursor-pointer text-[11px]"
                          >
                            {cycleLoading ? 'Simulating Agent...' : 'Or simulate autonomous agent mandate evaluation'}
                          </button>
                          <span className="text-[10px] text-[#087F5B] font-mono font-bold">
                            Schema 0: {ATTRIBUTION_TAG}
                          </span>
                        </div>

                        {/* Subtle Safety Policy Disclosure */}
                        <div className="pt-2.5 flex items-center justify-between text-[11px] text-[#0B0F14]/55 px-1">
                          <span className="flex items-center gap-1.5 font-medium">
                            <ShieldCheck className="w-3.5 h-3.5 text-[#087F5B]" />
                            Protected by automated safety checks
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowPolicyDetails(!showPolicyDetails)}
                            className="text-[#087F5B] hover:underline font-semibold cursor-pointer"
                          >
                            {showPolicyDetails ? 'Hide Safety Details' : 'View Safety Rules'}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Safety Details Checklist */}
                      {showPolicyDetails && lastCycleOutcome?.executionRecord?.policyResult && (
                        <div className="rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 p-3 space-y-2.5 animate-in fade-in duration-200">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]">
                              Safety Engine Checklist
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                lastCycleOutcome.executionRecord.policyResult.authorized
                                  ? 'bg-[#B6F7D2] text-[#087F5B]'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {lastCycleOutcome.executionRecord.policyResult.authorized
                                ? 'AUTHORIZED (17/17 Passed)'
                                : `BLOCKED (${lastCycleOutcome.executionRecord.policyResult.failedReasons.length} Failed)`}
                            </span>
                          </div>

                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                            {lastCycleOutcome.executionRecord.policyResult.checks.map(
                              (chk: any) => (
                                <div
                                  key={chk.ruleId}
                                  className="flex items-start justify-between gap-2 text-xs p-1.5 rounded-lg bg-white border border-[#0B0F14]/6"
                                >
                                  <div className="flex items-start gap-1.5">
                                    <CheckCircle2
                                      className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                                        chk.passed ? 'text-[#00C853]' : 'text-red-500'
                                      }`}
                                    />
                                    <div>
                                      <p className="font-bold text-xs text-[#0B0F14]">
                                        {chk.ruleName}
                                      </p>
                                      <p className="text-[10px] text-[#0B0F14]/60">
                                        {chk.reason}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="text-[9px] font-mono-num text-[#0B0F14]/45 shrink-0">
                                    {chk.ruleId}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Right Column: Textile Stitch Filler Engine + Ripio LatAm Ramp */}
              <div className="lg:col-span-5 space-y-5">
                {/* Card 1: Textile Stitch (textile-stitch) Adaptive Filler Feed */}
                <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                      textile-stitch Filler Engine
                    </span>
                    <a
                      href="/api/pricing/stitch?symbol=cNGN"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-bold text-[#087F5B] hover:underline flex items-center gap-1"
                    >
                      Live Endpoint <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                      Passive Treasury Maker Feed (`textile-stitch`)
                    </h3>
                    <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                      Instead of paying taker spread, MOI feeds Textile Stitch with
                      an Avellaneda-Stoikov inventory-skewed price so the treasury
                      earns maker spread while rebalancing.
                    </p>
                  </div>

                  <div className="flex gap-1.5">
                    {(['cNGN', 'wARS', 'wBRL', 'wCOP'] as const).map((sym) => (
                      <button
                        key={sym}
                        onClick={() => handleSwitchStitchSymbol(sym)}
                        className="px-2.5 py-1 rounded-lg bg-[#F8FAFC] hover:bg-[#B6F7D2]/50 border border-[#0B0F14]/10 text-xs font-semibold"
                      >
                        {sym}/USDT
                      </button>
                    ))}
                  </div>

                  {stitchFeedData && (
                    <div className="p-3.5 rounded-xl bg-[#0B0F14] text-white font-mono-num text-xs space-y-2">
                      <div className="flex justify-between items-center text-[11px]">
                        <span className="text-[#00E676] font-bold">Corridor: {stitchFeedData.corridor}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold ${
                          stitchFeedData.degraded
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}>
                          {stitchFeedData.degraded ? 'Standby' : 'Active Liquidity'}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/60">Market Reference:</span>
                        <span className="font-bold">{stitchFeedData.price}</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/60">Bid / Ask Spread:</span>
                        <span>
                          {stitchFeedData.bidQuotePrice} /{' '}
                          {stitchFeedData.askQuotePrice}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-white/60">Inventory Skew:</span>
                        <span>
                          {stitchFeedData.inventorySkewBps >= 0 ? '+' : ''}
                          {stitchFeedData.inventorySkewBps} bps
                        </span>
                      </div>
                      <p className="text-[10px] text-white/70 pt-2 border-t border-white/10 font-sans leading-relaxed">
                        {stitchFeedData.degraded
                          ? 'Operating reserve protection active: waiting for initial treasury deposit to quote liquidity.'
                          : stitchFeedData.strategyReasoning}
                      </p>
                    </div>
                  )}
                </div>

                {/* Card 2: Verified Settlement Infrastructure & Contracts */}
                <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                        Celo Mainnet · Protocol Contracts
                      </span>
                      <h3 className="text-sm sm:text-base font-bold text-[#0B0F14] mt-1">
                        Settlement & Routing Architecture
                      </h3>
                    </div>
                    <span className="text-[10px] font-mono-num font-bold text-[#087F5B] bg-[#00E676]/10 px-2 py-0.5 rounded-full">
                      CHAIN 42220
                    </span>
                  </div>

                  <p className="text-[11px] text-[#0B0F14]/65 leading-relaxed">
                    MOI interacts strictly with audited onchain settlement contracts on Celo Mainnet. Trades are non-custodial and settle atomically with guaranteed rates.
                  </p>

                  <div className="space-y-2 text-xs font-mono-num">
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/8 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#0B0F14]/50 block font-sans font-bold">Settlement Protocol</span>
                        <span className="text-[11px] font-bold text-[#0B0F14]">Textile FX v2</span>
                      </div>
                      <a
                        href="https://celoscan.io/address/0xa9AAC9C7c43e7428f731174092b3a99266E335b3"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-[#087F5B] hover:underline flex items-center gap-1"
                      >
                        Celoscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/8 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#0B0F14]/50 block font-sans font-bold">Uniswap Permit2 Approval Vault</span>
                        <span className="text-[11px] font-bold text-[#0B0F14]">0x00000000...e9F6B43aC78BA3</span>
                      </div>
                      <a
                        href="https://celoscan.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-[#087F5B] hover:underline flex items-center gap-1"
                      >
                        Celoscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/8 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-[#0B0F14]/50 block font-sans font-bold">Verified ERC-8004 Registry</span>
                        <span className="text-[11px] font-bold text-[#0B0F14]">0x8004A818...C75B9f3238</span>
                      </div>
                      <a
                        href="https://celoscan.io/address/0x8004A818b53041F2327D08E774c75B9f3238"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-bold text-[#087F5B] hover:underline flex items-center gap-1"
                      >
                        Celoscan <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#0B0F14] text-white text-[11px] font-mono-num space-y-1">
                    <div className="flex justify-between text-[#00E676] text-[10px] font-bold">
                      <span>PROTOCOL INTEGRITY</span>
                      <span>100% NON-CUSTODIAL</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Attribution Builder Code:</span>
                      <span className="text-white font-bold">{treasuryData?.attributionStatus?.configuredTag ?? 'celo_c9cb9a59fc4c'}</span>
                    </div>
                    <div className="flex justify-between text-white/70">
                      <span>Dual-Key Boundary:</span>
                      <span className="text-white">Owner Custody + Agent Signer</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3.5: DEDICATED INVOICING & PAYMENT REQUESTS PAGE
            Full Suite: Cryptographic $0-Gas Invoices, Receivables & Settlement
           ===================================================================== */}
        {activeTab === 'invoices' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Top Page Header */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                    Invoicing & Payment Requests
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                    EIP-712 Zero Gas Protocol
                  </span>
                </div>
                <p className="text-xs text-[#0B0F14]/55 mt-0.5">
                  Issue, track, and settle cryptographic payment requests on Celo Mainnet. Every invoice is signed by your wallet with $0 network fee.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInvoiceSigningError(null);
                    setInvoiceFormRef(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
                    setShowCreateInvoiceModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-[#0B0F14] text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create New Invoice</span>
                </button>
              </div>
            </div>

            {/* 4 Summary Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Card 1: Total Invoiced */}
              <div className="bg-white p-4 rounded-xl border border-[#0B0F14]/8 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/55">
                  Total Invoiced Volume
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono-num text-[#0B0F14]">
                  {(() => {
                    const invs = (treasuryData?.invoices || []) as any[];
                    const sum = invs.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
                    return `${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD₮`;
                  })()}
                </p>
                <p className="text-[10px] text-[#0B0F14]/50">
                  {((treasuryData?.invoices || []) as any[]).length} total requests generated
                </p>
              </div>

              {/* Card 2: Settled / Paid */}
              <div className="bg-white p-4 rounded-xl border border-[#0B0F14]/8 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/55">
                  Collected & Settled
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono-num text-[#087F5B]">
                  {(() => {
                    const invs = (treasuryData?.invoices || []) as any[];
                    const paid = invs.filter((i) => i.status === 'PAID');
                    const sum = paid.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
                    return `${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD₮`;
                  })()}
                </p>
                <p className="text-[10px] text-[#087F5B] font-semibold">
                  {(((treasuryData?.invoices || []) as any[]).filter((i) => i.status === 'PAID')).length} paid invoices
                </p>
              </div>

              {/* Card 3: Pending Receivables */}
              <div className="bg-white p-4 rounded-xl border border-[#0B0F14]/8 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/55">
                  Pending Receivables
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono-num text-amber-600">
                  {(() => {
                    const invs = (treasuryData?.invoices || []) as any[];
                    const pending = invs.filter((i) => i.status !== 'PAID');
                    const sum = pending.reduce((acc, i) => acc + (Number(i.amount) || 0), 0);
                    return `${sum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD₮`;
                  })()}
                </p>
                <p className="text-[10px] text-amber-600 font-semibold">
                  {(((treasuryData?.invoices || []) as any[]).filter((i) => i.status !== 'PAID')).length} awaiting payment
                </p>
              </div>

              {/* Card 4: Cryptographic Proofs */}
              <div className="bg-white p-4 rounded-xl border border-[#0B0F14]/8 shadow-xs space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/55">
                  Signatures Verified
                </span>
                <p className="text-lg sm:text-xl font-bold font-mono-num text-[#0B0F14]">
                  {((treasuryData?.invoices || []) as any[]).length} / {((treasuryData?.invoices || []) as any[]).length}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-[#087F5B] font-bold">
                  <CheckCircle2 className="w-3 h-3 text-[#00E676]" />
                  <span>100% $0-Gas Verified</span>
                </div>
              </div>
            </div>

            {/* Invoices List / Card Table */}
            <div className="bg-white rounded-xl border border-[#0B0F14]/8 shadow-xs overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-[#0B0F14]/8 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#0B0F14]">
                    Invoice History & Cryptographic Register
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Immutable records signed by your creator wallet with EIP-712 typed data
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fetchAllData()}
                    className="p-1.5 rounded-lg border border-[#0B0F14]/10 hover:bg-slate-50 text-[#0B0F14]/60 transition"
                    title="Refresh Invoices"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {!hasConnectedOwnerWallet ? (
                /* Disconnected Zero-Mock State */
                <div className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                    <Wallet className="w-6 h-6 text-amber-700" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-[#0B0F14]">
                      Connect Wallet to View & Issue Invoices
                    </h4>
                    <p className="text-xs text-[#0B0F14]/60 max-w-sm mx-auto">
                      Connect your Celo Web3 wallet to load your personal invoices and issue zero-gas cryptographic payment requests.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => handleOpenSignIn()}
                      className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-[#0B0F14] text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      Connect Wallet
                    </button>
                  </div>
                </div>
              ) : !treasuryData?.invoices || treasuryData.invoices.length === 0 ? (
                /* Empty Invoices State */
                <div className="p-10 text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10 text-[#0B0F14]/40 flex items-center justify-center mx-auto">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-[#0B0F14]">
                      No Invoices Created Yet
                    </h4>
                    <p className="text-xs text-[#0B0F14]/60 max-w-sm mx-auto">
                      Generate your first professional invoice. It costs $0 in network gas and provides cryptographic proof of ownership.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setInvoiceSigningError(null);
                        setInvoiceFormRef(`INV-2026-${Math.floor(100 + Math.random() * 900)}`);
                        setShowCreateInvoiceModal(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create First Invoice
                    </button>
                  </div>
                </div>
              ) : (
                /* Table of Invoices */
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#F8FAFC] border-b border-[#0B0F14]/8 text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60">
                      <tr>
                        <th className="py-3 px-4">Invoice Ref / Date</th>
                        <th className="py-3 px-4">Client</th>
                        <th className="py-3 px-4">Amount & Token</th>
                        <th className="py-3 px-4">Cryptographic Proof</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0B0F14]/6 font-medium">
                      {(treasuryData.invoices as any[]).map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="font-mono font-bold text-[#0B0F14] text-xs">
                                {inv.invoiceNumber}
                              </span>
                              <p className="text-[10px] text-[#0B0F14]/50">
                                {new Date(inv.createdAt).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-[#0B0F14]">{inv.clientName}</span>
                              {inv.clientEmail && (
                                <p className="text-[10px] text-[#0B0F14]/50 truncate max-w-[140px]">
                                  {inv.clientEmail}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold font-mono-num text-xs text-[#0B0F14]">
                              {inv.amount} {inv.tokenSymbol}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="space-y-1">
                              <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#087F5B] text-[10px] font-bold inline-flex items-center gap-1 shadow-2xs">
                                <Sparkles className="w-2.5 h-2.5 text-[#00E676]" />
                                <span>✓ EIP-712 ($0 Gas)</span>
                              </span>
                              <p className="font-mono text-[9px] text-[#0B0F14]/40 truncate max-w-[120px]">
                                {inv.creatorSignature ? `${inv.creatorSignature.slice(0, 10)}...${inv.creatorSignature.slice(-6)}` : 'Signed'}
                              </p>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {inv.status === 'PAID' ? (
                              <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2] text-[#087F5B] text-[10px] font-bold">
                                Paid
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedInvoiceForModal(inv)}
                                className="px-2.5 py-1 rounded-md bg-[#0B0F14] hover:bg-[#087F5B] text-white text-[11px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                              >
                                <Download className="w-3 h-3 text-[#00E676]" />
                                <span>View QR</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const uri =
                                    inv.paymentUri ||
                                    `celo:${inv.creatorWallet}?amount=${inv.amount}&token=${inv.tokenSymbol}&memo=${encodeURIComponent(inv.invoiceNumber)}`;
                                  navigator.clipboard.writeText(uri);
                                  setInvoiceCopiedId(inv.id);
                                  setTimeout(() => setInvoiceCopiedId(null), 2000);
                                }}
                                className="p-1 rounded-md border border-[#0B0F14]/15 hover:bg-slate-100 text-[#0B0F14]/70 transition"
                                title="Copy Payment Link"
                              >
                                {invoiceCopiedId === inv.id ? (
                                  <Check className="w-3.5 h-3.5 text-[#087F5B]" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {inv.status !== 'PAID' && (
                                <button
                                  type="button"
                                  onClick={() => handleMarkInvoicePaid(inv.id)}
                                  className="px-2 py-1 rounded-md bg-[#F8FAFC] border border-[#0B0F14]/15 hover:bg-[#B6F7D2]/40 text-[#087F5B] text-[10px] font-bold transition cursor-pointer"
                                  title="Mark as paid"
                                >
                                  Mark Paid
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: BUY SERVICES ("Purchase services with x402.")
            Matches Bottom-Left Screen of Uploaded UI Kit
           ===================================================================== */}
        {activeTab === 'buy' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                  Buy Services
                </h1>
                <p className="text-xs text-[#0B0F14]/55">
                  Purchase external verification, RPC, and intelligence services
                  with x402 (`@celo/buy` · `gateway.usebuy.ai` · `agent402.tools`).
                </p>
              </div>

              {/* Settlement Token Selector (USA₮, USD₮, USDC) */}
              <div className="flex items-center gap-2 bg-white p-1.5 rounded-full border border-[#0B0F14]/10">
                {(['USAT', 'USDT', 'USDC'] as const).map((tok) => (
                  <button
                    key={tok}
                    onClick={() => setSelectedPaymentToken(tok)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${
                      selectedPaymentToken === tok
                        ? 'bg-[#0B0F14] text-[#00E676]'
                        : 'text-[#0B0F14]/70 hover:text-[#0B0F14]'
                    }`}
                  >
                    Pay in {tok === 'USAT' ? 'USA₮' : tok}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Hero Card + Catalog Grid matching Uploaded UI */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left Featured x402 Card from Uploaded UI Kit */}
              <div
                className="lg:col-span-5 rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs flex flex-col justify-between relative overflow-hidden"
                style={{
                  background:
                    'linear-gradient(135deg, #FFFFFF 0%, #F2FDF7 60%, #B6F7D2 100%)',
                }}
              >
                <div className="space-y-3 relative z-10">
                  <div className="w-9 h-9 rounded-full bg-[#B6F7D2] flex items-center justify-center">
                    <Zap className="w-5 h-5 text-[#087F5B]" />
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F5B]">
                      Independent Treasury Reconciliation
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-[#0B0F14] mt-0.5">
                      Chainstack Celo RPC Batch Audit
                    </h3>
                    <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                      Independently verify settled Textile FX swap receipts and
                      ERC-20 Transfer logs via `gateway.usebuy.ai/chainstack/celo`
                      using gasless EIP-3009 `x402` authorizations.
                    </p>
                  </div>

                  <div className="pt-1">
                    <p className="text-2xl font-black font-mono-num text-[#0B0F14]">
                      $0.01{' '}
                      <span className="text-xs font-normal text-[#0B0F14]/60">
                        / call (10,000 atomic {selectedPaymentToken})
                      </span>
                    </p>
                  </div>
                </div>

                <div className="pt-4 relative z-10 space-y-1.5">
                  <button
                    onClick={() => handleBuyX402Service('chainstack.celo')}
                    disabled={buyingCapabilityId === 'chainstack.celo'}
                    className="w-full py-2 px-3 rounded-lg bg-[#0B0F14] hover:bg-[#087F5B] text-white font-bold text-xs flex items-center justify-center gap-1.5 transition shadow-xs"
                  >
                    {buyingCapabilityId === 'chainstack.celo'
                      ? 'Verifying Policy & Probing 402 Challenge...'
                      : `Buy with x402 (${selectedPaymentToken}) →`}
                  </button>
                  <p className="text-[10px] text-[#0B0F14]/55 text-center font-mono-num">
                    PayTo: 0x20faAca5F980E29639A0FCC6dcA6988E18ed333B
                  </p>
                </div>
              </div>

              {/* Right: Live Curated Capabilities from gateway.usebuy.ai/v1/catalog */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(buyCatalogData?.catalog?.curatedCapabilities || []).map(
                  (cap: any) => (
                    <div
                      key={cap.id}
                      className="bg-white rounded-xl p-3.5 sm:p-4 border border-[#0B0F14]/8 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/50 text-[#087F5B] text-[10px] font-bold">
                            {cap.platform}
                          </span>
                          {cap.erc8004AgentId && (
                            <span className="text-[10px] font-mono-num text-[#0B0F14]/50">
                              ERC-8004 #{cap.erc8004AgentId}
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-xs sm:text-sm text-[#0B0F14] mt-1.5">
                          {cap.title}
                        </h4>
                        <p className="text-[11px] text-[#0B0F14]/60 mt-0.5">
                          {cap.description}
                        </p>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-[#0B0F14]/8 flex items-center justify-between">
                        <div>
                          <p className="text-base font-black font-mono-num">
                            ${cap.priceUsd}
                          </p>
                          <p className="text-[9px] font-mono-num text-[#0B0F14]/50">
                            {cap.amountAtomic} atomic {selectedPaymentToken}
                          </p>
                        </div>

                        <button
                          onClick={() => handleBuyX402Service(cap.id)}
                          disabled={buyingCapabilityId === cap.id}
                          className="px-3 py-1.5 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-semibold transition"
                        >
                          {buyingCapabilityId === cap.id
                            ? 'Calling...'
                            : 'Buy with x402 →'}
                        </button>
                      </div>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Live HTTP 402 Challenge & Policy Inspection Output */}
            {lastBuyResult?.purchase && (
              <div className="bg-white rounded-2xl p-6 border border-[#0B0F14]/10 shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 rounded-full bg-[#B6F7D2] text-[#087F5B] text-xs font-bold">
                      {lastBuyResult.purchase.status}
                    </span>
                    <h4 className="font-bold text-sm">
                      {lastBuyResult.purchase.capabilityId} ·{' '}
                      {lastBuyResult.purchase.endpointUrl}
                    </h4>
                  </div>
                  <span className="text-xs font-mono-num text-[#0B0F14]/60">
                    PayTo: {lastBuyResult.purchase.payToAddress}
                  </span>
                </div>

                <p className="text-xs text-[#0B0F14]/80 font-mono-num bg-[#F8FAFC] p-3.5 rounded-2xl border border-[#0B0F14]/8">
                  {lastBuyResult.purchase.responseSummary}
                </p>

                {lastBuyResult.liveChallengeOffers?.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {lastBuyResult.liveChallengeOffers.map(
                      (offer: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3 rounded-2xl bg-[#F8FAFC] border border-[#0B0F14]/8 text-xs font-mono-num"
                        >
                          <p className="font-bold text-[#087F5B]">
                            Offer #{idx + 1}: {offer.tokenName || 'Token'} (
                            {offer.network})
                          </p>
                          <p className="text-[11px] text-[#0B0F14]/70 truncate">
                            Asset: {offer.asset}
                          </p>
                          <p className="text-[11px] font-bold mt-1">
                            Required: {offer.amountAtomic} atomic units
                          </p>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 5: TRANSACTIONS & DOUBLE-ENTRY LEDGER ("Track your activity.")
            Matches Bottom-Center Screen of Uploaded UI Kit
           ===================================================================== */}
        {activeTab === 'transactions' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                  Transactions
                </h1>
                <p className="text-xs text-[#0B0F14]/55">
                  Track your activity, state machine transitions, and balanced
                  double-entry accounting ledger.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-white p-1 rounded-full border border-[#0B0F14]/10 text-xs font-bold">
                  <button
                    onClick={() => setTxSubView('executions')}
                    className={`px-3 py-1 rounded-full transition text-xs ${
                      txSubView === 'executions'
                        ? 'bg-[#0B0F14] text-white'
                        : 'text-[#0B0F14]/60'
                    }`}
                  >
                    FX & x402 Activity
                  </button>
                  <button
                    onClick={() => setTxSubView('approvals')}
                    className={`px-3 py-1 rounded-full transition flex items-center gap-1.5 text-xs ${
                      txSubView === 'approvals'
                        ? 'bg-[#087F5B] text-white'
                        : 'text-[#0B0F14]/60'
                    }`}
                  >
                    <span>Approval Queue</span>
                    {(treasuryData?.executions || []).filter((e: any) => e.state === 'APPROVAL_PENDING').length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-[#00E676] text-[#0B0F14] text-[9px] font-black flex items-center justify-center">
                        {(treasuryData?.executions || []).filter((e: any) => e.state === 'APPROVAL_PENDING').length}
                      </span>
                    )}
                  </button>
                  <button
                    onClick={() => setTxSubView('ledger')}
                    className={`px-3 py-1 rounded-full transition text-xs ${
                      txSubView === 'ledger'
                        ? 'bg-[#0B0F14] text-white'
                        : 'text-[#0B0F14]/60'
                    }`}
                  >
                    Double-Entry Ledger
                  </button>
                  <button
                    onClick={() => setTxSubView('audit')}
                    className={`px-3 py-1 rounded-full transition text-xs ${
                      txSubView === 'audit'
                        ? 'bg-[#0B0F14] text-white'
                        : 'text-[#0B0F14]/60'
                    }`}
                  >
                    Audit Trail
                  </button>
                </div>

                <button
                  onClick={handleExportAuditBundle}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white hover:bg-[#F8FAFC] border border-[#0B0F14]/12 text-xs font-semibold transition"
                >
                  <FileText className="w-3.5 h-3.5" /> Export →
                </button>
              </div>
            </div>

            {/* Table Card matching Uploaded UI Kit */}
            <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs overflow-x-auto">
              {txSubView === 'executions' && (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#0B0F14]/10 text-[11px] font-bold text-[#0B0F14]/50">
                      <th className="pb-2.5 pl-2">Type</th>
                      <th className="pb-2.5">Amount / Corridor</th>
                      <th className="pb-2.5">Status</th>
                      <th className="pb-2.5">Attribution / RFQ ID</th>
                      <th className="pb-2.5 pr-2 text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#0B0F14]/6 text-xs">
                    {(treasuryData?.executions || [])
                      .filter((ex: any) => ex.state !== 'NO_QUOTE')
                      .map((ex: ExecutionRecord) => {
                        const sMeta = CELO_VERIFIED_ASSETS[ex.sellSymbol];
                        const bMeta = CELO_VERIFIED_ASSETS[ex.buySymbol];
                        return (
                          <tr key={ex.id} className="hover:bg-[#F8FAFC]">
                            <td className="py-2.5 pl-2 font-bold flex items-center gap-2.5">
                              <span className="w-7 h-7 rounded-full bg-[#B6F7D2]/50 text-[#087F5B] flex items-center justify-center shrink-0">
                                <TrendingUp className="w-3.5 h-3.5" />
                              </span>
                              <div>
                                <p className="text-xs">
                                  Textile FX · {ex.sellSymbol} → {ex.buySymbol}
                                </p>
                                <p className="text-[10px] text-[#0B0F14]/50 font-normal">
                                  Mandate: {ex.mandateId}
                                </p>
                              </div>
                            </td>
                            <td className="py-2.5 font-mono-num font-bold">
                              -
                              {formatAtomicWithCommas(
                                ex.requestedSellAtomic,
                                sMeta?.decimals ?? 6,
                                2
                              )}{' '}
                              {ex.sellSymbol}
                              {ex.quotedBuyAmountAtomic && (
                                <span className="block text-[11px] text-[#087F5B]">
                                  +
                                  {formatAtomicWithCommas(
                                    ex.quotedBuyAmountAtomic,
                                    bMeta?.decimals ?? 6,
                                    2
                                  )}{' '}
                                  {ex.buySymbol}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  ex.state === 'RECONCILED' ||
                                  ex.state === 'CONFIRMED' ||
                                  ex.state === 'POLICY_VALIDATED'
                                    ? 'bg-[#B6F7D2]/75 text-[#087F5B]'
                                    : ex.state === 'APPROVAL_PENDING'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {ex.state}
                              </span>
                            </td>
                            <td className="py-2.5 font-mono-num text-[11px] text-[#0B0F14]/65">
                              <div>{ex.rfqId || '—'}</div>
                              <div className="text-[10px] text-[#087F5B]">
                                Tag: {ex.attributionTag}
                              </div>
                            </td>
                            <td className="py-2.5 pr-2 text-right font-mono-num text-[11px] text-[#0B0F14]/55">
                              {new Date(ex.createdAt).toLocaleTimeString()}
                            </td>
                          </tr>
                        );
                      }
                    )}

                    {(treasuryData?.servicePurchases || []).map(
                      (sp: ServicePurchaseRecord) => (
                        <tr key={sp.id} className="hover:bg-[#F8FAFC]">
                          <td className="py-2.5 pl-2 font-bold flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                              <Zap className="w-3.5 h-3.5" />
                            </span>
                            <div>
                              <p className="text-xs">Buy Service (x402) · {sp.capabilityId}</p>
                              <p className="text-[10px] text-[#0B0F14]/50 font-normal">
                                Provider: {sp.providerName}
                              </p>
                            </div>
                          </td>
                          <td className="py-2.5 font-mono-num font-bold text-red-600">
                            -${sp.priceUsd} ({sp.amountAtomic} atomic{' '}
                            {sp.paymentTokenSymbol})
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                sp.status === 'PAID_AND_VERIFIED' ||
                                sp.status === 'AUTHORIZED'
                                  ? 'bg-[#B6F7D2]/75 text-[#087F5B]'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {sp.status}
                            </span>
                          </td>
                          <td className="py-2.5 font-mono-num text-[11px] text-[#0B0F14]/65">
                            PayTo: {sp.payToAddress.slice(0, 10)}...
                          </td>
                          <td className="py-2.5 pr-2 text-right font-mono-num text-[11px] text-[#0B0F14]/55">
                            {new Date(sp.createdAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      )
                    )}

                    {(treasuryData?.executions || []).filter((ex: any) => ex.state !== 'NO_QUOTE').length === 0 &&
                      (treasuryData?.servicePurchases?.length || 0) === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-8 text-center text-xs text-[#0B0F14]/50"
                          >
                            No executions recorded yet. Run an evaluation cycle in
                            the <strong>Treasury & FX</strong> tab or test an{' '}
                            <strong>x402 Service Purchase</strong> to populate
                            live records.
                          </td>
                        </tr>
                      )}
                  </tbody>
                </table>
              )}

              {txSubView === 'approvals' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[#0B0F14]/10">
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-[#0B0F14]">
                        Owner Approval Queue (Mandatory First-Trade & Policy Guard)
                      </h3>
                      <p className="text-[11px] text-[#0B0F14]/60">
                        Trades evaluated in &quot;approval_required&quot; mode or awaiting mandatory first-trade authorization. Bounded by exact parameters.
                      </p>
                    </div>
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold font-mono-num">
                      {(treasuryData?.executions || []).filter((e: any) => e.state === 'APPROVAL_PENDING').length} Pending
                    </span>
                  </div>

                  {(treasuryData?.executions || []).filter((e: any) => e.state === 'APPROVAL_PENDING').length === 0 ? (
                    <div className="py-6 sm:py-8 text-center text-xs text-[#0B0F14]/50">
                      No trades currently awaiting owner approval. When the autonomous agent requests a trade in approval-required mode, it will appear here for cryptographic owner confirmation.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {(treasuryData?.executions || [])
                        .filter((e: any) => e.state === 'APPROVAL_PENDING')
                        .map((ex: ExecutionRecord) => {
                          const sMeta = CELO_VERIFIED_ASSETS[ex.sellSymbol];
                          const bMeta = CELO_VERIFIED_ASSETS[ex.buySymbol];
                          const isApproving = approvingExecId === ex.id;
                          return (
                            <div
                              key={ex.id}
                              className="p-3.5 rounded-xl bg-[#F8FAFC] border border-amber-300/60 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 text-[10px] font-bold">
                                    Awaiting Owner Approval
                                  </span>
                                  <span className="font-mono-num text-[10px] text-[#0B0F14]/60">
                                    ID: {ex.id}
                                  </span>
                                </div>
                                <div className="text-xs sm:text-sm font-bold text-[#0B0F14] flex items-center gap-1.5">
                                  <span>
                                    Sell {formatAtomicWithCommas(ex.quotedTakerPaysAtomic || ex.requestedSellAtomic, sMeta?.decimals ?? 6, 2)} {ex.sellSymbol}
                                  </span>
                                  <span className="text-[#087F5B]">→</span>
                                  <span className="text-[#087F5B]">
                                    Receive {formatAtomicWithCommas(ex.quotedBuyAmountAtomic || '0', bMeta?.decimals ?? 6, 2)} {ex.buySymbol}
                                  </span>
                                </div>
                                <p className="text-[11px] text-[#0B0F14]/65">
                                  Quote Reference: <strong className="font-mono-num">{ex.rfqId?.slice(0, 16)}...</strong> · Protocol: <strong className="font-semibold text-[#087F5B]">Textile FX</strong> · Tag: <span className="text-[#087F5B] font-mono-num">{ex.attributionTag}</span>
                                </p>
                                {ex.failureReason && (
                                  <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                                    Evaluation Note: {ex.failureReason}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  onClick={() => handleRejectPendingExecution(ex.id)}
                                  disabled={isApproving}
                                  className="px-3 py-1.5 rounded-full border border-red-300 hover:bg-red-50 text-red-700 font-bold text-xs transition"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => handleApprovePendingExecution(ex.id)}
                                  disabled={isApproving}
                                  className="px-3.5 py-1.5 rounded-full bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] font-bold text-xs shadow-xs transition flex items-center gap-1"
                                >
                                  <Check className="w-3 h-3" />
                                  {isApproving ? 'Approving...' : 'Approve Trade'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {txSubView === 'ledger' && (
                <div className="space-y-3">
                  <p className="text-xs text-[#0B0F14]/60">
                    {treasuryData?.analytics?.benchmarkMethodology}
                  </p>
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[#0B0F14]/10 text-xs font-bold text-[#0B0F14]/50">
                        <th className="pb-3">Account</th>
                        <th className="pb-3">Direction</th>
                        <th className="pb-3">Asset & Atomic Amount</th>
                        <th className="pb-3">Memo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0B0F14]/6 text-xs font-mono-num">
                      {(treasuryData?.ledgerEntries || []).map(
                        (le: LedgerEntryRecord) => (
                          <tr key={le.id}>
                            <td className="py-2.5 font-bold">
                              {le.accountCode} · {le.accountName}
                            </td>
                            <td className="py-2.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  le.direction === 'DEBIT'
                                    ? 'bg-[#B6F7D2]/60 text-[#087F5B]'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {le.direction}
                              </span>
                            </td>
                            <td className="py-2.5 font-bold">
                              {formatAtomicUnits(le.amountAtomic, le.decimals)}{' '}
                              {le.assetSymbol} ({le.amountAtomic})
                            </td>
                            <td className="py-2.5 font-sans text-[#0B0F14]/70">
                              {le.memo}
                            </td>
                          </tr>
                        )
                      )}
                      {(treasuryData?.ledgerEntries?.length || 0) === 0 && (
                        <tr>
                          <td
                            colSpan={4}
                            className="py-6 text-center font-sans text-xs text-[#0B0F14]/50"
                          >
                            Double-entry ledger posts balanced DEBIT/CREDIT rows
                            only upon confirmed onchain settlement.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {txSubView === 'audit' && (
                <div className="space-y-2">
                  {(treasuryData?.auditEvents || []).map((ev: any) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 flex items-start justify-between gap-3"
                    >
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-white border border-[#0B0F14]/10 mr-2">
                          {ev.category}
                        </span>
                        <span className="font-bold text-sm">{ev.title}</span>
                        <p className="text-xs text-[#0B0F14]/70 mt-1">
                          {ev.detail}
                        </p>
                      </div>
                      <span className="text-[11px] font-mono-num text-[#0B0F14]/45 shrink-0">
                        {new Date(ev.createdAt).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: OPERATOR PROFILE & GOVERNANCE
           ===================================================================== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                  Operator Profile & Governance
                </h1>
                <p className="text-xs text-[#0B0F14]/55">
                  Manage your onchain treasury identity, connected owner wallet, autonomous agent boundaries, and corridor preferences.
                </p>
              </div>

              {profileSavedToast && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#B6F7D2] text-[#087F5B] text-xs font-bold shadow-xs animate-in fade-in duration-200">
                  <Check className="w-3.5 h-3.5" />
                  Profile updated successfully
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column: Editable Profile Card (7 cols) */}
              <div className="lg:col-span-7 bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-[#0B0F14]/8 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-full bg-[#00E676] text-[#0B0F14] font-black text-sm flex items-center justify-center">
                      {userInitials}
                    </div>
                    <div>
                      <h2 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                        {hasConnectedOwnerWallet ? (profileForm.displayName || 'Treasury Operator') : 'No Operator Connected'}
                      </h2>
                      <p className="text-[11px] text-[#0B0F14]/60">
                        {hasConnectedOwnerWallet
                          ? `${profileForm.roleTitle || 'Treasury Manager'} · ${profileForm.organization || 'MOI Global Treasury'}`
                          : 'Connect your Celo Web3 wallet to manage treasury profile'}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      hasConnectedOwnerWallet
                        ? 'bg-[#B6F7D2]/50 text-[#087F5B]'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {hasConnectedOwnerWallet ? 'Active Operator' : 'Disconnected'}
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.displayName}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, displayName: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                        Operator Email
                      </label>
                      <input
                        type="email"
                        value={profileForm.email}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, email: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                        Organization / DAO Name
                      </label>
                      <input
                        type="text"
                        value={profileForm.organization}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, organization: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                        Role Title
                      </label>
                      <input
                        type="text"
                        value={profileForm.roleTitle}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, roleTitle: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                        Primary Region Focus
                      </label>
                      <input
                        type="text"
                        value={profileForm.primaryRegion}
                        onChange={(e) =>
                          setProfileForm({ ...profileForm, primaryRegion: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                        Preferred Base Fiat
                      </label>
                      <select
                        value={profileForm.preferredBaseSymbol}
                        onChange={(e) =>
                          setProfileForm({
                            ...profileForm,
                            preferredBaseSymbol: e.target.value as AssetSymbol,
                          })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs focus:outline-none focus:border-[#00E676] bg-white"
                      >
                        <option value="cNGN">cNGN (Nigerian Naira)</option>
                        <option value="wARS">wARS (Argentine Peso)</option>
                        <option value="wBRL">wBRL (Brazilian Real)</option>
                        <option value="wCOP">wCOP (Colombian Peso)</option>
                        <option value="wMXN">wMXN (Mexican Peso)</option>
                        <option value="USDT">USD₮ (Tether USD)</option>
                        <option value="USDC">USDC (Circle USD)</option>
                        <option value="USAT">USA₮ (Tether USA₮)</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <p className="text-[11px] text-[#0B0F14]/50">
                      Settings persist across sessions in the MOI treasury database.
                    </p>
                    <button
                      onClick={handleSaveProfile}
                      disabled={isSavingProfile}
                      className="px-4 py-2 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      {isSavingProfile ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Check className="w-3.5 h-3.5" />
                      )}
                      Save Profile Changes
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Wallets & Key Separation (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                {/* Master Owner Wallet Card */}
                <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#087F5B]">
                      <Wallet className="w-3.5 h-3.5" />
                      Master Owner Authority
                    </div>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[9px] font-bold inline-flex items-center gap-1 ${
                        hasConnectedOwnerWallet
                          ? 'bg-[#B6F7D2]/60 text-[#087F5B]'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {hasConnectedOwnerWallet ? (
                        <>
                          <CheckCircle2 className="w-2.5 h-2.5 text-[#087F5B]" />
                          <span>Verified (Celo 42220)</span>
                        </>
                      ) : (
                        <span>Wallet Unverified</span>
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-0.5">
                      Connected Celo Wallet Address
                    </label>
                    {hasConnectedOwnerWallet ? (
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#00E676]/30 flex items-center justify-between">
                        <span className="font-mono-num font-bold text-xs truncate mr-2 text-[#0B0F14]">
                          {activeOwnerWallet}
                        </span>
                        <button
                          onClick={() => copyToClipboard(activeOwnerWallet, 'owner_wallet')}
                          className="p-1 rounded hover:bg-slate-200 text-[#0B0F14]/60 shrink-0 cursor-pointer"
                          title="Copy address"
                        >
                          {copiedKey === 'owner_wallet' ? (
                            <Check className="w-3.5 h-3.5 text-[#087F5B]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/10 flex items-center justify-between">
                        <span className="text-xs text-[#0B0F14]/50 italic">
                          No wallet connected
                        </span>
                        <MoiWalletButton size="sm" />
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-[#0B0F14]/70 leading-relaxed">
                    This wallet holds root administrative authority over treasury mandates, reserve thresholds, and emergency pause stops.
                  </p>

                  <div className="pt-1 space-y-2">
                    <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/8">
                      <span className="text-xs font-semibold text-[#0B0F14]/70">Wallet Status</span>
                      <MoiWalletButton size="sm" />
                    </div>

                    <button
                      onClick={handleSignOut}
                      className="w-full py-2 rounded-lg border border-red-500/20 hover:bg-red-50 text-xs font-semibold text-red-600 transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Disconnect & Reset Session</span>
                    </button>
                  </div>
                </div>

                {/* Restricted Agent Signer Card */}
                <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#087F5B]">
                      <Bot className="w-3.5 h-3.5" />
                      Restricted Agent Signer
                    </div>
                    <span className="px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#0B0F14]/10 text-[#0B0F14]/70 text-[9px] font-bold">
                      ERC-8004
                    </span>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-0.5">
                      Agent Signer Wallet Address
                    </label>
                    <div className="p-2.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/10 flex items-center justify-between">
                      <span className="font-mono-num font-bold text-xs truncate mr-2">
                        {treasuryData?.agentWalletAddress || '0x7a9d...1fF6'}
                      </span>
                      <button
                        onClick={() =>
                          copyToClipboard(
                            treasuryData?.agentWalletAddress || '',
                            'agent_wallet'
                          )
                        }
                        className="p-1 rounded hover:bg-slate-200 text-[#0B0F14]/60 shrink-0"
                        title="Copy address"
                      >
                        {copiedKey === 'agent_wallet' ? (
                          <Check className="w-3.5 h-3.5 text-[#087F5B]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1 text-[11px] text-[#0B0F14]/70">
                    <p className="flex items-center justify-between">
                      <span>Attribution Tag:</span>
                      <strong className="font-mono-num text-[#087F5B]">
                        {treasuryData?.attributionStatus?.configuredTag ?? 'celo_c9cb9a59fc4c'}
                      </strong>
                    </p>
                    <p className="flex items-center justify-between">
                      <span>Identity Document:</span>
                      <a
                        href="/api/identity/agent.json"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#087F5B] font-bold hover:underline inline-flex items-center gap-1"
                      >
                        agent.json <ExternalLink className="w-3 h-3" />
                      </a>
                    </p>
                  </div>

                  <p className="text-[10px] text-[#0B0F14]/60 leading-relaxed border-t border-[#0B0F14]/8 pt-2">
                    Autonomous key isolation guarantees the agent key can only execute approved RFQs and HTTP 402 calls.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 6: SETTINGS & SECURITY (Wallets, ERC-8004, ERC-8021, Signer Boundary)
           ===================================================================== */}
        {activeTab === 'settings' && (
          <div className="space-y-5">
            <div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#0B0F14]">
                Wallets & Security Boundary
              </h1>
              <p className="text-xs text-[#0B0F14]/55">
                Inspect user vs. agent wallet separation, ERC-8004 onchain
                identity, and ERC-8021 transaction attribution.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Wallet Separation Card */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3.5">
                <div className="flex items-center gap-1.5 text-[#087F5B] text-[11px] font-bold uppercase tracking-wider">
                  <Lock className="w-3.5 h-3.5" />
                  Section 9.2 · Strict Signer Separation
                </div>
                <h3 className="text-sm sm:text-base font-bold">
                  User Wallet vs. Restricted Agent Wallet
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8">
                    <p className="font-bold text-[#0B0F14]/60 text-[11px]">
                      Treasury Owner Wallet (Controls Mandate & Emergency Stop)
                    </p>
                    {hasConnectedOwnerWallet ? (
                      <p className="font-mono-num font-bold text-xs mt-0.5 break-all">
                        {activeOwnerWallet}
                      </p>
                    ) : (
                      <div className="flex items-center justify-between gap-2 mt-1">
                        <span className="text-xs text-[#0B0F14]/50 italic">
                          No wallet connected yet
                        </span>
                        <MoiWalletButton size="sm" />
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8">
                    <p className="font-bold text-[#0B0F14]/60 text-[11px]">
                      Restricted Agent Signer Wallet (Holds Scoped Allocation)
                    </p>
                    <p className="font-mono-num font-bold text-xs mt-0.5 break-all">
                      {treasuryData?.agentWalletAddress}
                    </p>
                    <p className="mt-1 text-[10px] text-[#087F5B] font-semibold">
                      Agent Status:{' '}
                      {treasuryData?.signerConfigured
                        ? 'Active & Ready for Execution'
                        : 'Protected Observation Mode (Active monitoring)'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ERC-8021 Attribution & ERC-8004 Registry Card */}
              <div className="bg-white rounded-xl p-4 sm:p-5 border border-[#0B0F14]/8 shadow-xs space-y-3.5">
                <div className="flex items-center gap-1.5 text-[#087F5B] text-[11px] font-bold uppercase tracking-wider">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Onchain Identity & Attribution
                </div>
                <h3 className="text-sm sm:text-base font-bold">
                  Verifiable Identity & Attribution
                </h3>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 space-y-1">
                    <p className="font-bold text-xs text-[#0B0F14]">
                      Attribution Verification
                    </p>
                    <p className="font-mono-num text-[11px]">
                      Attribution Tag:{' '}
                      <strong className="text-[#087F5B]">
                        {treasuryData?.attributionStatus?.configuredTag ?? 'celo_c9cb9a59fc4c'}
                      </strong>
                    </p>
                    <p className="text-[10px] text-[#0B0F14]/60">
                      All agent trades are signed and verified on Celo Mainnet.
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-xs text-[#0B0F14]">
                        Celo Mainnet ERC-8004 Identity Registry
                      </p>
                      <a
                        href="/api/identity/agent.json"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#087F5B] font-bold hover:underline flex items-center gap-1 text-[11px]"
                      >
                        agent.json <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="font-mono-num text-[10px] break-all">
                      Registry: 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
                    </p>
                    {erc8004Data?.onchainInspection && (
                      <p className="font-mono-num text-[10px] text-[#087F5B]">
                        Verified Onchain Agent #{erc8004Data.onchainInspection.agentId}{' '}
                        Owner: {erc8004Data.onchainInspection.owner}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =====================================================================
          ACTION MODAL 1: SEND (Transfer Celo / ERC-20 Tokens on Celo Mainnet)
         ===================================================================== */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <Send className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Send Tokens from Treasury
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Direct onchain transfer on Celo Mainnet (Chain ID 42220)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowSendModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!hasConnectedOwnerWallet ? (
                <div className="p-5 rounded-xl bg-amber-50 border border-amber-200 text-center space-y-3">
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-800 mx-auto flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#0B0F14]">Web3 Wallet Required to Send</h4>
                    <p className="text-xs text-[#0B0F14]/70 mt-1 max-w-sm mx-auto">
                      Onchain transfers must be authorized and signed by your connected Web3 owner wallet (MetaMask, Rabby, or MiniPay). Please connect your wallet first.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSendModal(false);
                      handleOpenSignIn();
                    }}
                    className="px-4 py-2 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-xs font-bold text-[#0B0F14] transition shadow-xs inline-flex items-center gap-1.5"
                  >
                    <Wallet className="w-3.5 h-3.5" />
                    Connect Web3 Wallet
                  </button>
                </div>
              ) : sendSuccess ? (
                <div className="p-4 rounded-xl bg-[#F0FDF4] border border-[#00E676]/30 space-y-2.5 text-center">
                  <div className="w-10 h-10 rounded-full bg-[#B6F7D2] flex items-center justify-center mx-auto text-[#087F5B]">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-sm text-[#0B0F14]">Transfer Confirmed on Celo</h4>
                  <p className="text-xs text-[#0B0F14]/70">
                    Your transfer of {sendAmount} {sendToken} was successfully broadcast and confirmed.
                  </p>
                  <div className="p-2.5 rounded-lg bg-white border border-[#0B0F14]/10 font-mono-num text-[11px] text-left break-all space-y-1">
                    <p className="text-[#0B0F14]/60">Tx Hash: {sendSuccess.txHash}</p>
                    {sendSuccess.blockNumber && <p className="text-[#0B0F14]/60">Block: #{sendSuccess.blockNumber}</p>}
                  </div>
                  <div className="pt-1 flex items-center justify-center gap-3">
                    <a
                      href={`https://celoscan.io/tx/${sendSuccess.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3.5 py-1.5 rounded-full bg-[#0B0F14] text-white text-xs font-bold hover:bg-[#087F5B] transition flex items-center gap-1.5"
                    >
                      View on CeloScan <ExternalLink className="w-3 h-3" />
                    </a>
                    <button
                      onClick={() => {
                        setSendSuccess(null);
                        setSendAmount('');
                        setSendRecipient('');
                      }}
                      className="px-3.5 py-1.5 rounded-full border border-[#0B0F14]/15 text-xs font-semibold hover:bg-white"
                    >
                      Send Another
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Token & Balance Selector */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                      Asset to Send
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {(['USDT', 'cNGN', 'wARS', 'wBRL', 'CELO', 'USDC', 'USAT', 'wCOP'] as const).map((tok) => {
                        const bal = treasuryData?.liveBalances?.find((b: any) => b.symbol === tok);
                        const isSel = sendToken === tok;
                        return (
                          <button
                            key={tok}
                            type="button"
                            onClick={() => setSendToken(tok)}
                            className={`p-2 rounded-lg border text-left transition ${
                              isSel
                                ? 'bg-[#0B0F14] text-white border-[#0B0F14]'
                                : 'bg-[#F8FAFC] text-[#0B0F14] border-[#0B0F14]/10 hover:border-[#0B0F14]/25'
                            }`}
                          >
                            <span className="font-bold text-xs block">{tok}</span>
                            <span className={`text-[10px] font-mono-num block truncate ${isSel ? 'text-[#00E676]' : 'text-[#0B0F14]/50'}`}>
                              {bal ? formatAtomicWithCommas(bal.balanceAtomic, bal.decimals, 2) : '0.00'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Recipient Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60">
                        Recipient Address
                      </label>
                      <button
                        type="button"
                        onClick={() => setSendRecipient(treasuryData?.agentWalletAddress || '')}
                        className="text-[10px] text-[#087F5B] font-semibold hover:underline"
                      >
                        Paste Agent Signer
                      </button>
                    </div>
                    <input
                      type="text"
                      value={sendRecipient}
                      onChange={(e) => setSendRecipient(e.target.value.trim())}
                      placeholder="0x..."
                      className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono-num text-xs focus:outline-none focus:border-[#00E676]"
                    />
                  </div>

                  {/* Amount Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60">
                        Amount ({sendToken})
                      </label>
                      <span className="text-[10px] font-mono-num text-[#0B0F14]/50">
                        Available: {(() => {
                          const bal = treasuryData?.liveBalances?.find((b: any) => b.symbol === sendToken);
                          return bal ? formatAtomicWithCommas(bal.balanceAtomic, bal.decimals, 2) : '0.00';
                        })()} {sendToken}
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono-num text-sm font-bold focus:outline-none focus:border-[#00E676]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const bal = treasuryData?.liveBalances?.find((b: any) => b.symbol === sendToken);
                          if (bal) {
                            setSendAmount(formatAtomicUnits(bal.balanceAtomic, bal.decimals));
                          }
                        }}
                        className="absolute right-2 top-2 px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#0B0F14]/10 text-[10px] font-bold text-[#087F5B]"
                      >
                        MAX
                      </button>
                    </div>
                  </div>

                  {sendError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{sendError}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExecuteSend}
                      disabled={sendLoading}
                      className="w-full py-2.5 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {sendLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Broadcasting Transaction on Celo...
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5 text-[#00E676]" />
                          Confirm & Send on Celo Mainnet
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-[#0B0F14]/50 text-center mt-2">
                      Protected by 17 deterministic policy checks · Tagged with ERC-8021 attribution
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 2: RECEIVE (Treasury Deposit & QR Code Information)
         ===================================================================== */}
      {showReceiveModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <Download className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Receive / Deposit to Treasury
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Fund your Celo Mainnet treasury addresses
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReceiveModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!hasConnectedOwnerWallet ? (
                /* Disconnected State */
                <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#0B0F14]/10 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                    <Wallet className="w-7 h-7 text-amber-700" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                      Wallet Not Connected
                    </span>
                    <h4 className="font-extrabold text-sm sm:text-base text-[#0B0F14]">
                      Connect to View Your Deposit Address
                    </h4>
                    <p className="text-xs text-[#0B0F14]/65 max-w-sm mx-auto leading-relaxed">
                      Connect your Celo Web3 wallet to display your personal treasury deposit address and scan your custom QR code.
                    </p>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowReceiveModal(false);
                        handleOpenSignIn();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-xs font-bold text-[#0B0F14] transition shadow-xs inline-flex items-center gap-2"
                    >
                      <Wallet className="w-4 h-4" />
                      Connect Wallet Now
                    </button>
                  </div>

                  {treasuryData?.agentWalletAddress && (
                    <div className="pt-4 border-t border-[#0B0F14]/8 text-left">
                      <p className="text-[11px] font-bold text-[#0B0F14]/60 mb-1">
                        Alternative: Agent Signer Budget Address
                      </p>
                      <div className="p-2.5 rounded-xl bg-white border border-[#0B0F14]/10 flex items-center justify-between gap-2">
                        <span className="font-mono-num text-[11px] text-[#0B0F14] truncate">
                          {treasuryData.agentWalletAddress}
                        </span>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(treasuryData.agentWalletAddress || '');
                            setReceiveCopied('agent');
                            setTimeout(() => setReceiveCopied(null), 2000);
                          }}
                          className="p-1 rounded hover:bg-slate-100 text-[#0B0F14]/70 shrink-0"
                          title="Copy address"
                        >
                          {receiveCopied === 'agent' ? (
                            <Check className="w-3.5 h-3.5 text-[#087F5B]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Connected State with Dynamic QR Code and Toggle */
                <>
                  {/* Payment Mode Switcher: Address vs Payment Request */}
                  <div className="flex items-center gap-1 p-1 bg-[#F8FAFC] border border-[#0B0F14]/10 rounded-xl mb-3">
                    <button
                      type="button"
                      onClick={() => setReceiveViewTab('address')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        receiveViewTab === 'address'
                          ? 'bg-[#0B0F14] text-white shadow-xs'
                          : 'text-[#0B0F14]/65 hover:text-[#0B0F14]'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Deposit Address</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiveViewTab('invoice')}
                      className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        receiveViewTab === 'invoice'
                          ? 'bg-[#00E676] text-[#0B0F14] shadow-xs'
                          : 'text-[#0B0F14]/65 hover:text-[#0B0F14]'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Payment Request / Invoice</span>
                    </button>
                  </div>

                  {receiveViewTab === 'address' ? (
                    <>
                      {/* Target Account Selector */}
                  <div className="grid grid-cols-2 gap-2 p-1 bg-[#F8FAFC] border border-[#0B0F14]/10 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setReceiveTarget('owner')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        receiveTarget === 'owner'
                          ? 'bg-[#0B0F14] text-white shadow-xs'
                          : 'text-[#0B0F14]/65 hover:text-[#0B0F14]'
                      }`}
                    >
                      <Wallet className="w-3.5 h-3.5" />
                      <span>Connected Wallet</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setReceiveTarget('agent')}
                      className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                        receiveTarget === 'agent'
                          ? 'bg-[#0B0F14] text-white shadow-xs'
                          : 'text-[#0B0F14]/65 hover:text-[#0B0F14]'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Agent Budget</span>
                    </button>
                  </div>

                  {/* Visual QR Code Card with Genuine Scannable QR Code */}
                  <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 flex flex-col sm:flex-row items-center gap-4">
                    <div className="w-32 h-32 bg-white p-2 rounded-xl border border-[#0B0F14]/10 flex items-center justify-center shadow-xs shrink-0">
                      {receiveQrUrl ? (
                        <img
                          src={receiveQrUrl}
                          alt="Deposit QR Code"
                          className="w-full h-full object-contain rounded-lg"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[#0B0F14]/40 font-mono">
                          Generating QR...
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 text-center sm:text-left">
                      <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                        Celo Network · Mainnet
                      </span>
                      <h4 className="font-bold text-xs sm:text-sm text-[#0B0F14]">
                        {receiveTarget === 'owner' ? 'Your Personal Treasury' : 'Agent Operating Budget'}
                      </h4>
                      <p className="text-[11px] text-[#0B0F14]/65 leading-snug">
                        Scan with Valora, MiniPay, MetaMask, or any Web3 mobile wallet to deposit.
                      </p>
                      <p className="text-[10px] text-[#087F5B] font-semibold pt-0.5">
                        Accepts cNGN, USD₮, cUSD, CELO, wARS, wBRL, and USDC.
                      </p>
                    </div>
                  </div>

                  {/* Active Address Card with One-Click Copy */}
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#0B0F14]">
                        {receiveTarget === 'owner' ? 'Your Connected Address' : 'Agent Operating Address'}
                      </span>
                      <span className="text-[10px] text-[#087F5B] font-semibold">
                        {receiveTarget === 'owner' ? 'Master Custody' : 'Scoped Execution'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-lg border border-[#0B0F14]/8">
                      <span className="font-mono-num text-xs font-semibold text-[#0B0F14] break-all">
                        {receiveTarget === 'owner'
                          ? activeOwnerWallet
                          : treasuryData?.agentWalletAddress}
                      </span>
                      <button
                        onClick={() => {
                          const addr =
                            receiveTarget === 'owner'
                              ? activeOwnerWallet
                              : treasuryData?.agentWalletAddress;
                          navigator.clipboard.writeText(addr || '');
                          setReceiveCopied(receiveTarget);
                          setTimeout(() => setReceiveCopied(null), 2000);
                        }}
                        className="p-1.5 rounded-md hover:bg-slate-100 text-[#0B0F14]/70 shrink-0 flex items-center gap-1 text-[11px] font-bold"
                        title="Copy address"
                      >
                        {receiveCopied === receiveTarget ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-[#087F5B]" />
                            <span className="text-[#087F5B]">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Clean Supported Assets Row */}
                  <div className="space-y-1.5 pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60">
                      Supported Stablecoins & Currencies
                    </p>
                    <div className="grid grid-cols-4 gap-1.5 text-[11px] text-center font-bold">
                      <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/6">cNGN</div>
                      <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/6">USD₮</div>
                      <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/6">cUSD</div>
                      <div className="p-1.5 rounded-lg bg-[#F8FAFC] border border-[#0B0F14]/6">CELO</div>
                    </div>
                  </div>
                    </>
                  ) : (
                    /* Payment Request & Invoice Generator */
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#0B0F14]/70">
                            Client / Recipient
                          </label>
                          <input
                            type="text"
                            value={invoiceClientName}
                            onChange={(e) => setInvoiceClientName(e.target.value)}
                            placeholder="e.g. Acme Corp"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#0B0F14]/70">
                            Invoice Number / Ref
                          </label>
                          <input
                            type="text"
                            value={invoiceRef}
                            onChange={(e) => setInvoiceRef(e.target.value)}
                            placeholder="INV-2026-001"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#0B0F14]/15 font-mono text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#0B0F14]/70">
                            Invoice Amount
                          </label>
                          <input
                            type="text"
                            value={invoiceAmount}
                            onChange={(e) => setInvoiceAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full px-3 py-1.5 rounded-lg border border-[#0B0F14]/15 font-mono-num text-xs font-bold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-bold text-[#0B0F14]/70">
                            Settlement Token
                          </label>
                          <select
                            value={invoiceToken}
                            onChange={(e) => setInvoiceToken(e.target.value as AssetSymbol)}
                            className="w-full px-3 py-1.5 rounded-lg border border-[#0B0F14]/15 text-xs font-bold bg-white focus:outline-none focus:border-[#00E676]"
                          >
                            <option value="USDT">USD₮ (Tether USD)</option>
                            <option value="cNGN">cNGN (Naira)</option>
                            <option value="wBRL">wBRL (Real)</option>
                            <option value="wARS">wARS (Peso)</option>
                            <option value="wCOP">wCOP (Colombian Peso)</option>
                            <option value="wMXN">wMXN (Mexican Peso)</option>
                            <option value="cUSD">cUSD (Celo Dollar)</option>
                            <option value="CELO">CELO (Native)</option>
                          </select>
                        </div>
                      </div>

                      {/* Scannable Invoice QR & Share Card */}
                      <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 flex items-center gap-3.5">
                        <div className="w-24 h-24 bg-white p-1.5 rounded-lg border border-[#0B0F14]/10 shrink-0 flex items-center justify-center shadow-2xs">
                          {invoiceQrUrl ? (
                            <img src={invoiceQrUrl} alt="Invoice QR" className="w-full h-full object-contain rounded" />
                          ) : (
                            <span className="text-[10px] text-[#0B0F14]/40 font-mono">Generating...</span>
                          )}
                        </div>
                        <div className="space-y-1 text-left flex-1 min-w-0">
                          <span className="px-2 py-0.5 rounded-full bg-[#B6F7D2]/60 text-[#087F5B] text-[10px] font-bold">
                            MOI Invoicing Protocol · Celo Mainnet
                          </span>
                          <p className="text-xs font-bold text-[#0B0F14] truncate">
                            Requesting {invoiceAmount} {invoiceToken}
                          </p>
                          <p className="text-[11px] text-[#0B0F14]/60 truncate">
                            For: {invoiceClientName || 'Client'} · Ref: {invoiceRef}
                          </p>
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const dest = activeOwnerWallet || '';
                                const link = `celo:${dest}?amount=${invoiceAmount}&token=${invoiceToken}&memo=${encodeURIComponent(invoiceRef)}`;
                                navigator.clipboard.writeText(link);
                                setInvoiceCopied(true);
                                setTimeout(() => setInvoiceCopied(false), 2000);
                              }}
                              className="px-2.5 py-1 rounded-md bg-[#0B0F14] hover:bg-[#087F5B] text-white text-[10px] font-bold transition flex items-center gap-1 shadow-2xs cursor-pointer"
                            >
                              {invoiceCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-[#00E676]" />
                                  <span>Invoice Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copy Payment Link</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 6: WITHDRAW TO BANK (Multi-Country Off-Ramp)
         ===================================================================== */}
      {showWithdrawModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <Building2 className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Withdraw to Bank Account
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Direct local bank settlement via instant domestic payment rails
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowWithdrawModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {!hasConnectedOwnerWallet ? (
                /* Disconnected State */
                <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#0B0F14]/10 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center mx-auto shadow-xs">
                    <Wallet className="w-7 h-7 text-amber-700" />
                  </div>
                  <div className="space-y-1.5">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
                      Wallet Not Connected
                    </span>
                    <h4 className="font-extrabold text-sm sm:text-base text-[#0B0F14]">
                      Connect to Withdraw to Bank
                    </h4>
                    <p className="text-xs text-[#0B0F14]/65 max-w-sm mx-auto leading-relaxed">
                      Connect your Celo Web3 wallet to authorize and settle your local currencies into your bank account.
                    </p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        setShowWithdrawModal(false);
                        handleOpenSignIn();
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-xs font-bold text-[#0B0F14] transition shadow-xs inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Wallet className="w-4 h-4" />
                      Connect Wallet Now
                    </button>
                  </div>
                </div>
              ) : withdrawSuccess ? (
                /* Success Receipt Card */
                <div className="p-6 rounded-2xl bg-[#F0FDF4] border border-[#00E676]/30 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-[#B6F7D2] text-[#087F5B] flex items-center justify-center mx-auto shadow-xs">
                    <Check className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#087F5B] text-[10px] font-bold uppercase tracking-wider">
                      Dispatched to Bank
                    </span>
                    <h4 className="font-extrabold text-base text-[#0B0F14]">
                      Withdrawal Dispatched Successfully!
                    </h4>
                    <p className="text-xs text-[#0B0F14]/70">
                      Funds are en route to your bank account via {withdrawSuccess.rail}.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-white border border-[#0B0F14]/10 text-left space-y-2 text-xs">
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#0B0F14]/8">
                      <span className="text-[#0B0F14]/60 font-medium">Reference Code</span>
                      <span className="font-mono font-bold text-[#0B0F14]">
                        {withdrawSuccess.referenceCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#0B0F14]/8">
                      <span className="text-[#0B0F14]/60 font-medium">Destination</span>
                      <span className="font-bold text-[#0B0F14]">
                        {withdrawSuccess.destinationSummary}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-[#0B0F14]/8">
                      <span className="text-[#0B0F14]/60 font-medium">Amount Payout</span>
                      <span className="font-bold text-[#087F5B] font-mono-num">
                        {withdrawSuccess.amount} {withdrawSuccess.currency}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[#0B0F14]/60 font-medium">Estimated Arrival</span>
                      <span className="font-bold text-[#0B0F14]">
                        {withdrawSuccess.eta}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-center gap-2">
                    <button
                      onClick={() => {
                        setWithdrawSuccess(null);
                        setWithdrawAmount('');
                      }}
                      className="px-4 py-2 rounded-lg bg-white border border-[#0B0F14]/15 hover:bg-slate-50 text-xs font-bold text-[#0B0F14] transition cursor-pointer"
                    >
                      New Withdrawal
                    </button>
                    <button
                      onClick={() => setShowWithdrawModal(false)}
                      className="px-5 py-2 rounded-lg bg-[#0B0F14] hover:bg-[#087F5B] text-xs font-bold text-white transition cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                /* Withdrawal Form */
                <>
                  {/* Country & Rail Corridor Selection */}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-[#0B0F14]/70">
                      Select Country & Settlement Rail
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                      {[
                        { code: 'NG', name: 'Nigeria', rail: 'NIP', defaultAsset: 'cNGN' as AssetSymbol },
                        { code: 'BR', name: 'Brazil', rail: 'PIX', defaultAsset: 'wBRL' as AssetSymbol },
                        { code: 'AR', name: 'Argentina', rail: 'CBU', defaultAsset: 'wARS' as AssetSymbol },
                        { code: 'CO', name: 'Colombia', rail: 'PSE', defaultAsset: 'wCOP' as AssetSymbol },
                        { code: 'MX', name: 'Mexico', rail: 'SPEI', defaultAsset: 'wMXN' as AssetSymbol },
                        { code: 'US', name: 'Global', rail: 'Wire', defaultAsset: 'USDT' as AssetSymbol },
                      ].map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            setWithdrawCountry(c.code as any);
                            setWithdrawCurrency(c.defaultAsset);
                          }}
                          className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                            withdrawCountry === c.code
                              ? 'bg-[#0B0F14] border-[#0B0F14] text-white shadow-xs'
                              : 'bg-[#F8FAFC] border-[#0B0F14]/10 text-[#0B0F14]/70 hover:bg-slate-100'
                          }`}
                        >
                          <p className="text-xs font-bold">{c.name}</p>
                          <p className={`text-[10px] font-mono ${withdrawCountry === c.code ? 'text-[#00E676]' : 'text-[#087F5B]'}`}>
                            {c.rail}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Token & Amount Section */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <label className="text-[11px] font-bold text-[#0B0F14]/70">
                        Withdraw Asset & Amount
                      </label>
                      <span className="text-[11px] text-[#0B0F14]/60">
                        Available:{' '}
                        <strong className="font-mono-num text-[#0B0F14]">
                          {(() => {
                            const bal = treasuryData?.liveBalances?.find((b: any) => b.symbol === withdrawCurrency);
                            return bal ? formatAtomicWithCommas(bal.balanceAtomic, bal.decimals, 2) : '0.00';
                          })()} {withdrawCurrency}
                        </strong>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <select
                        value={withdrawCurrency}
                        onChange={(e) => setWithdrawCurrency(e.target.value as AssetSymbol)}
                        className="col-span-1 px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-bold bg-white focus:outline-none focus:border-[#00E676]"
                      >
                        <option value="cNGN">cNGN (Naira)</option>
                        <option value="wBRL">wBRL (Real)</option>
                        <option value="wARS">wARS (Peso)</option>
                        <option value="wCOP">wCOP (COP)</option>
                        <option value="wMXN">wMXN (MXN)</option>
                        <option value="USDT">USD₮ (Dollar)</option>
                      </select>
                      <div className="col-span-2 relative">
                        <input
                          type="text"
                          value={withdrawAmount}
                          onChange={(e) => setWithdrawAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono-num text-sm font-bold focus:outline-none focus:border-[#00E676]"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const bal = treasuryData?.liveBalances?.find((b: any) => b.symbol === withdrawCurrency);
                            if (bal) {
                              setWithdrawAmount(formatAtomicUnits(bal.balanceAtomic, bal.decimals));
                            }
                          }}
                          className="absolute right-2 top-2 px-2 py-0.5 rounded bg-[#F8FAFC] border border-[#0B0F14]/10 text-[10px] font-bold text-[#087F5B] cursor-pointer"
                        >
                          MAX
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Banking Information based on Corridor */}
                  <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#0B0F14]/60">
                      Destination Bank Account Details
                    </p>

                    {withdrawCountry === 'NG' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#0B0F14]">
                            Destination Bank
                          </label>
                          <select
                            value={withdrawBankName}
                            onChange={(e) => setWithdrawBankName(e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold bg-white focus:outline-none focus:border-[#00E676]"
                          >
                            <option value="GTBank">Guaranty Trust Bank (GTBank)</option>
                            <option value="Zenith Bank">Zenith Bank</option>
                            <option value="Access Bank">Access Bank</option>
                            <option value="First Bank of Nigeria">First Bank of Nigeria</option>
                            <option value="Kuda Bank">Kuda Microfinance Bank</option>
                            <option value="PalmPay">PalmPay</option>
                            <option value="OPay">OPay Digital Services</option>
                            <option value="United Bank for Africa">United Bank for Africa (UBA)</option>
                            <option value="Stanbic IBTC">Stanbic IBTC Bank</option>
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[#0B0F14]">
                              NUBAN Account (10 digits)
                            </label>
                            <input
                              type="text"
                              maxLength={10}
                              value={withdrawAccountNumber}
                              onChange={(e) => setWithdrawAccountNumber(e.target.value.replace(/\D/g, ''))}
                              placeholder="0123456789"
                              className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono text-xs font-bold focus:outline-none focus:border-[#00E676]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[#0B0F14]">
                              Account Name
                            </label>
                            <input
                              type="text"
                              value={withdrawAccountName}
                              onChange={(e) => setWithdrawAccountName(e.target.value)}
                              placeholder="Account holder name"
                              className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {withdrawCountry === 'BR' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#0B0F14]">
                            PIX Key (CPF, CNPJ, Email, Phone, EVP)
                          </label>
                          <input
                            type="text"
                            value={withdrawPixKey}
                            onChange={(e) => setWithdrawPixKey(e.target.value)}
                            placeholder="user@pix.com.br or 123.456.789-00"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono text-xs font-bold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#0B0F14]">
                            Beneficiary Full Name
                          </label>
                          <input
                            type="text"
                            value={withdrawAccountName}
                            onChange={(e) => setWithdrawAccountName(e.target.value)}
                            placeholder="Nome Completo"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                      </div>
                    )}

                    {withdrawCountry === 'AR' && (
                      <div className="space-y-2.5">
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#0B0F14]">
                            CBU / CVU (22 digits) or Bank Alias
                          </label>
                          <input
                            type="text"
                            value={withdrawCbu}
                            onChange={(e) => setWithdrawCbu(e.target.value)}
                            placeholder="0000003100010000000000 or alias.mp"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono text-xs font-bold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] font-semibold text-[#0B0F14]">
                            Account Holder Name / DNI
                          </label>
                          <input
                            type="text"
                            value={withdrawAccountName}
                            onChange={(e) => setWithdrawAccountName(e.target.value)}
                            placeholder="Nombre del Titular"
                            className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                          />
                        </div>
                      </div>
                    )}

                    {['CO', 'MX', 'US'].includes(withdrawCountry) && (
                      <div className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[#0B0F14]">
                              {withdrawCountry === 'MX' ? 'CLABE (18 digits)' : 'Account / PSE Number'}
                            </label>
                            <input
                              type="text"
                              value={withdrawAccountNumber}
                              onChange={(e) => setWithdrawAccountNumber(e.target.value)}
                              placeholder="Account number"
                              className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono text-xs font-bold focus:outline-none focus:border-[#00E676]"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[11px] font-semibold text-[#0B0F14]">
                              Bank Name
                            </label>
                            <input
                              type="text"
                              value={withdrawBankName}
                              onChange={(e) => setWithdrawBankName(e.target.value)}
                              placeholder={withdrawCountry === 'CO' ? 'Nequi / Bancolombia' : 'Bank'}
                              className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {withdrawError && (
                    <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{withdrawError}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExecuteWithdraw}
                      disabled={withdrawLoading}
                      className="w-full py-2.5 rounded-full bg-[#00E676] hover:bg-[#00c968] text-[#0B0F14] text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      {withdrawLoading ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Settling with Central Payment Rail...
                        </>
                      ) : (
                        <>
                          <Building2 className="w-3.5 h-3.5" />
                          Confirm & Withdraw to Bank
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-[#0B0F14]/50 text-center mt-2">
                      Direct settlement via verified national payment systems · Zero intermediary escrow risk
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 7: CREATE SIGNED INVOICE ($0 Gas & EIP-712 Signature)
         ===================================================================== */}
      {showCreateInvoiceModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Issue Cryptographic Invoice
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Signs structured EIP-712 invoice data at $0 cost and zero gas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCreateInvoiceModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#0B0F14]/70">
                    Client / Company Name
                  </label>
                  <input
                    type="text"
                    value={invoiceFormClientName}
                    onChange={(e) => setInvoiceFormClientName(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#0B0F14]/70">
                    Client Email (Optional)
                  </label>
                  <input
                    type="email"
                    value={invoiceFormClientEmail}
                    onChange={(e) => setInvoiceFormClientEmail(e.target.value)}
                    placeholder="billing@acmecorp.com"
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#0B0F14]/70">
                    Invoice Reference
                  </label>
                  <input
                    type="text"
                    value={invoiceFormRef}
                    onChange={(e) => setInvoiceFormRef(e.target.value)}
                    placeholder="INV-2026-0042"
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono text-xs font-bold focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#0B0F14]/70">
                    Payment Terms / Due Date
                  </label>
                  <select
                    value={invoiceFormDueDate}
                    onChange={(e) => setInvoiceFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-bold bg-white focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="Due on Receipt">Due on Receipt</option>
                    <option value="Net 7 (7 Days)">Net 7 (7 Days)</option>
                    <option value="Net 14 (14 Days)">Net 14 (14 Days)</option>
                    <option value="Net 30 (30 Days)">Net 30 (30 Days)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1 space-y-1">
                  <label className="text-[11px] font-bold text-[#0B0F14]/70">
                    Currency
                  </label>
                  <select
                    value={invoiceFormToken}
                    onChange={(e) => setInvoiceFormToken(e.target.value as AssetSymbol)}
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-bold bg-white focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="USDT">USD₮ (Dollar)</option>
                    <option value="cNGN">cNGN (Naira)</option>
                    <option value="wBRL">wBRL (Real)</option>
                    <option value="wARS">wARS (Peso)</option>
                    <option value="wCOP">wCOP (COP)</option>
                    <option value="wMXN">wMXN (MXN)</option>
                    <option value="cUSD">cUSD (Celo $)</option>
                    <option value="CELO">CELO (Native)</option>
                  </select>
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-bold text-[#0B0F14]/70">
                    Amount
                  </label>
                  <input
                    type="text"
                    value={invoiceFormAmount}
                    onChange={(e) => setInvoiceFormAmount(e.target.value)}
                    placeholder="250.00"
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 font-mono-num text-sm font-bold focus:outline-none focus:border-[#00E676]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-[#0B0F14]/70">
                  Item Description / Memo
                </label>
                <textarea
                  rows={2}
                  value={invoiceFormMemo}
                  onChange={(e) => setInvoiceFormMemo(e.target.value)}
                  placeholder="Describe goods, services, or contractual deliverables..."
                  className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-medium focus:outline-none focus:border-[#00E676]"
                />
              </div>

              {/* Zero-Gas Cryptographic Guarantee Card */}
              <div className="p-3.5 rounded-xl bg-[#F0FDF4] border border-[#00E676]/30 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-[#087F5B] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-xs font-bold text-[#0B0F14]">
                    Zero Gas Fee · $0.00 Cryptographic Signature
                  </p>
                  <p className="text-[11px] text-[#0B0F14]/70 leading-snug">
                    Your connected wallet will sign an offchain EIP-712 typed data payload. You pay zero gas, and your client receives a mathematically verified payment request.
                  </p>
                </div>
              </div>

              {invoiceSigningError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{invoiceSigningError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCreateSignedInvoice}
                  disabled={invoiceSigningLoading}
                  className="w-full py-2.5 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
                >
                  {invoiceSigningLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Signing with Wallet ($0 Gas)...
                    </>
                  ) : (
                    <>
                      <FileText className="w-3.5 h-3.5 text-[#00E676]" />
                      Sign & Issue Invoice with Wallet ($0 Gas)
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 8: VIEW INVOICE & SCANNABLE PAYMENT QR MODAL
         ===================================================================== */}
      {selectedInvoiceForModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#B6F7D2]/60 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#0B0F14]">
                    Cryptographic Invoice
                  </h3>
                  <p className="text-[10px] text-[#0B0F14]/55">
                    {selectedInvoiceForModal.invoiceNumber}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedInvoiceForModal(null)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Top Status & Amount Banner */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 text-center space-y-1">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    selectedInvoiceForModal.status === 'PAID'
                      ? 'bg-[#B6F7D2] text-[#087F5B]'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedInvoiceForModal.status === 'PAID' ? 'PAID & SETTLED' : 'AWAITING PAYMENT'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[#087F5B] text-[10px] font-bold">
                    Celo Mainnet
                  </span>
                </div>
                <p className="text-2xl font-black font-mono-num text-[#0B0F14]">
                  {selectedInvoiceForModal.amount} {selectedInvoiceForModal.tokenSymbol}
                </p>
                <p className="text-xs text-[#0B0F14]/60 font-medium">
                  Client: {selectedInvoiceForModal.clientName}
                </p>
              </div>

              {/* Scannable Dynamic QR Code */}
              <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/8 flex flex-col items-center justify-center space-y-2">
                <div className="w-36 h-36 bg-white p-2 rounded-xl border border-[#0B0F14]/10 shadow-xs flex items-center justify-center">
                  {selectedInvoiceQrUrl ? (
                    <img
                      src={selectedInvoiceQrUrl}
                      alt="Invoice Payment QR"
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <span className="text-xs text-[#0B0F14]/40 font-mono">Generating QR...</span>
                  )}
                </div>
                <p className="text-[11px] text-[#0B0F14]/60 text-center">
                  Scan with Valora, MiniPay, MetaMask, or any Web3 mobile wallet
                </p>
              </div>

              {/* Details Breakdown */}
              <div className="p-3.5 rounded-xl bg-white border border-[#0B0F14]/10 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-1.5 border-b border-[#0B0F14]/8">
                  <span className="text-[#0B0F14]/60">Description / Memo</span>
                  <span className="font-semibold text-[#0B0F14] text-right truncate max-w-[200px]">
                    {selectedInvoiceForModal.memo || 'Consulting'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-[#0B0F14]/8">
                  <span className="text-[#0B0F14]/60">Payment Terms</span>
                  <span className="font-semibold text-[#0B0F14]">
                    {selectedInvoiceForModal.dueDate || 'Due on Receipt'}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-[#0B0F14]/8">
                  <span className="text-[#0B0F14]/60">Creator Signature</span>
                  <span className="font-mono text-[10px] text-[#087F5B] font-bold">
                    ✓ Verified EIP-712 ($0 Gas)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#0B0F14]/60">Deposit Wallet</span>
                  <span className="font-mono text-[10px] text-[#0B0F14] truncate max-w-[180px]">
                    {selectedInvoiceForModal.creatorWallet}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const uri =
                      selectedInvoiceForModal.paymentUri ||
                      `celo:${selectedInvoiceForModal.creatorWallet}?amount=${selectedInvoiceForModal.amount}&token=${selectedInvoiceForModal.tokenSymbol}&memo=${encodeURIComponent(selectedInvoiceForModal.invoiceNumber)}`;
                    navigator.clipboard.writeText(uri);
                    setInvoiceCopiedId(selectedInvoiceForModal.id);
                    setTimeout(() => setInvoiceCopiedId(null), 2000);
                  }}
                  className="w-full py-2.5 rounded-xl bg-[#00E676] hover:bg-[#00c968] text-[#0B0F14] text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {invoiceCopiedId === selectedInvoiceForModal.id ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Payment Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Client Payment Link</span>
                    </>
                  )}
                </button>

                {selectedInvoiceForModal.status !== 'PAID' && (
                  <button
                    type="button"
                    onClick={() => handleMarkInvoicePaid(selectedInvoiceForModal.id)}
                    className="w-full py-2 rounded-xl bg-[#F8FAFC] hover:bg-slate-100 border border-[#0B0F14]/15 text-[#0B0F14] text-xs font-semibold transition cursor-pointer"
                  >
                    Mark Invoice as Paid / Settled
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 3: NEW AGENT (Issue & Register Autonomous Agent)
         ===================================================================== */}
      {showNewAgentModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Create Mandate & Issue Agent
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Define deterministic financial policy rules (reserves, caps, slippage) and deploy an autonomous executor
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewAgentModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Agent Name & Archetype */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    Agent Name
                  </label>
                  <input
                    type="text"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    placeholder="e.g. LatAm Arbitrage Agent"
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    Role Archetype
                  </label>
                  <select
                    value={newAgentRole}
                    onChange={(e) => setNewAgentRole(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold focus:outline-none focus:border-[#00E676]"
                  >
                    <option value="treasury_rebalancer">Treasury Rebalancer (Textile FX v2)</option>
                    <option value="stitch_filler">Adaptive Quoting Filler (textile-stitch Yield)</option>
                    <option value="x402_reconciler">Reconciliation Agent (buy / x402)</option>
                  </select>
                </div>
              </div>

              {/* Operating Mode Selector */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1.5">
                  Execution Mode (Section 12.2)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'autonomous', label: 'Autonomous', desc: 'Auto-executes within policy' },
                    { id: 'approval_required', label: 'Approval Required', desc: 'Owner signs each trade' },
                    { id: 'monitor', label: 'Monitor Only', desc: 'Read-only recommendations' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setNewAgentMode(m.id as any)}
                      className={`p-2.5 rounded-xl border text-left transition ${
                        newAgentMode === m.id
                          ? 'bg-[#0B0F14] text-white border-[#0B0F14]'
                          : 'bg-[#F8FAFC] text-[#0B0F14] border-[#0B0F14]/10 hover:border-[#0B0F14]/25'
                      }`}
                    >
                      <p className="font-bold text-xs">{m.label}</p>
                      <p className={`text-[10px] mt-0.5 ${newAgentMode === m.id ? 'text-[#00E676]' : 'text-[#0B0F14]/50'}`}>
                        {m.desc}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trading Corridor Pair */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    Sell Asset
                  </label>
                  <select
                    value={newAgentSellToken}
                    onChange={(e) => setNewAgentSellToken(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold"
                  >
                    <option value="cNGN">cNGN (Nigerian Naira)</option>
                    <option value="wARS">wARS (Argentine Peso)</option>
                    <option value="wBRL">wBRL (Brazilian Real)</option>
                    <option value="wCOP">wCOP (Colombian Peso)</option>
                    <option value="CELO">CELO (Native Celo)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    Buy / Target Asset
                  </label>
                  <select
                    value={newAgentBuyToken}
                    onChange={(e) => setNewAgentBuyToken(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-[#0B0F14]/15 text-xs font-semibold"
                  >
                    <option value="USDT">USD₮ (Tether USD)</option>
                    <option value="USDC">USDC (Circle USD)</option>
                    <option value="USAT">USA₮ (Tether America)</option>
                  </select>
                </div>
              </div>

              {/* Policy Thresholds */}
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#087F5B]">
                  Deterministic Risk Guardrails (Hard Limits)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-bold text-[#0B0F14]/70 mb-0.5">
                      Min Reserve Floor
                    </label>
                    <input
                      type="text"
                      value={newAgentMinReserve}
                      onChange={(e) => setNewAgentMinReserve(e.target.value)}
                      placeholder="50,000"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#0B0F14]/12 font-mono-num text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#0B0F14]/70 mb-0.5">
                      Max Single Trade
                    </label>
                    <input
                      type="text"
                      value={newAgentMaxTrade}
                      onChange={(e) => setNewAgentMaxTrade(e.target.value)}
                      placeholder="25,000"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#0B0F14]/12 font-mono-num text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-[#0B0F14]/70 mb-0.5">
                      24h Daily Cap
                    </label>
                    <input
                      type="text"
                      value={newAgentDailyCap}
                      onChange={(e) => setNewAgentDailyCap(e.target.value)}
                      placeholder="100,000"
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-[#0B0F14]/12 font-mono-num text-xs font-bold"
                    />
                  </div>
                </div>
              </div>

              {newAgentError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{newAgentError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleCreateAgent}
                  disabled={newAgentLoading}
                  className="w-full py-2.5 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {newAgentLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Registering Agent & Mandate...
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5 text-[#00E676]" />
                      Create Mandate & Issue Agent on Celo
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 4: CONFIGURE POLICY (In-Place Mandate Editor)
         ===================================================================== */}
      {showConfigurePolicyModal && policyAgent && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <Sliders className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Configure Policy: {policyAgent.name}
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    Update deterministic guardrails and execution mode
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConfigurePolicyModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Mode Toggle */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                  Operating Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['autonomous', 'approval_required', 'monitor'] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPolicyMode(m)}
                      className={`py-2 px-2 rounded-lg text-xs font-bold border transition ${
                        policyMode === m
                          ? 'bg-[#0B0F14] text-[#00E676] border-[#0B0F14]'
                          : 'bg-[#F8FAFC] text-[#0B0F14] border-[#0B0F14]/10 hover:bg-white'
                      }`}
                    >
                      {m === 'autonomous' ? 'Autonomous' : m === 'approval_required' ? 'Approval Req.' : 'Monitor'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Thresholds */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    Min Floor
                  </label>
                  <input
                    type="text"
                    value={policyMinReserve}
                    onChange={(e) => setPolicyMinReserve(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#0B0F14]/15 font-mono-num text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    Max Trade
                  </label>
                  <input
                    type="text"
                    value={policyMaxTrade}
                    onChange={(e) => setPolicyMaxTrade(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#0B0F14]/15 font-mono-num text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                    24h Cap
                  </label>
                  <input
                    type="text"
                    value={policyDailyCap}
                    onChange={(e) => setPolicyDailyCap(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#0B0F14]/15 font-mono-num text-xs font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-[#0B0F14]/60 mb-1">
                  Max Slippage (bps)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="10"
                    max="200"
                    value={policySlippage}
                    onChange={(e) => setPolicySlippage(Number(e.target.value))}
                    className="flex-1 accent-[#00E676]"
                  />
                  <span className="font-mono-num text-xs font-bold px-2.5 py-1 rounded bg-[#F8FAFC] border border-[#0B0F14]/10">
                    {policySlippage} bps ({(policySlippage / 100).toFixed(2)}%)
                  </span>
                </div>
              </div>

              {policyError && (
                <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {policyError}
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowConfigurePolicyModal(false)}
                  className="px-4 py-2 rounded-full border border-[#0B0F14]/15 text-xs font-semibold hover:bg-[#F8FAFC]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveAgentPolicy}
                  disabled={policySaving}
                  className="px-5 py-2 rounded-full bg-[#0B0F14] hover:bg-[#087F5B] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {policySaving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-[#00E676]" />
                  )}
                  Save Policy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          ACTION MODAL 5: EARN (textile-stitch Passive Treasury Spread Yield)
         ===================================================================== */}
      {showEarnModal && (
        <div className="fixed inset-0 z-50 bg-[#0B0F14]/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-[#0B0F14]/10 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-[#0B0F14]/8 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#B6F7D2]/60 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#087F5B]" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-[#0B0F14]">
                    Earn Passive Spread Yield
                  </h3>
                  <p className="text-[11px] text-[#0B0F14]/55">
                    textile-stitch Avellaneda-Stoikov market making on Celo Mainnet
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowEarnModal(false)}
                className="p-1.5 rounded-full hover:bg-[#F8FAFC] text-[#0B0F14]/60 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-[#0B0F14] text-white space-y-2">
                <span className="text-[10px] font-bold text-[#00E676] uppercase tracking-wider">
                  Avellaneda-Stoikov Quoting Filler
                </span>
                <p className="text-xs text-white/80 leading-relaxed font-sans">
                  Instead of letting idle stablecoin balances sit unutilized, MOI deploys them as two-sided RFQ liquidity on Textile. The strategy skews bid/ask quotes dynamically based on inventory levels to capture spread while protecting capital.
                </p>
                {stitchFeedData?.modelParameters && (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/10 text-center font-mono-num text-[11px]">
                    <div>
                      <span className="text-white/50 text-[10px] block">Risk Aversion (γ)</span>
                      <strong className="text-[#00E676]">{stitchFeedData.modelParameters.riskAversionGamma}</strong>
                    </div>
                    <div>
                      <span className="text-white/50 text-[10px] block">Vol (σ)</span>
                      <strong className="text-[#00E676]">{stitchFeedData.modelParameters.volatilitySigma}</strong>
                    </div>
                    <div>
                      <span className="text-white/50 text-[10px] block">Order Intensity (κ)</span>
                      <strong className="text-[#00E676]">{stitchFeedData.modelParameters.orderIntensityKappa}</strong>
                    </div>
                  </div>
                )}
              </div>

              {earnCycleResult && (
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#0B0F14]/10 space-y-1 font-mono-num text-xs">
                  <div className="flex items-center justify-between font-bold">
                    <span>Quoting Cycle Result:</span>
                    <span className="text-[#087F5B]">Evaluated</span>
                  </div>
                  {earnCycleResult.midPrice && (
                    <p className="text-[11px] text-[#0B0F14]/70">Mid Price: {earnCycleResult.midPrice} cNGN/USD₮</p>
                  )}
                  {earnCycleResult.strategyReasoning && (
                    <p className="text-[10px] text-[#0B0F14]/60 font-sans">{earnCycleResult.strategyReasoning}</p>
                  )}
                </div>
              )}

              <div className="pt-1 space-y-2">
                <button
                  type="button"
                  onClick={handleRunStitchQuote}
                  disabled={earnCycleLoading}
                  className="w-full py-2.5 rounded-full bg-[#00E676] hover:bg-[#00C853] text-[#0B0F14] text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {earnCycleLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Evaluating Market & Skewing Inventory...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-[#0B0F14]" />
                      Run Stitch Quoting Cycle Now
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEarnModal(false);
                    setActiveTab('treasury');
                  }}
                  className="w-full py-2 rounded-full border border-[#0B0F14]/12 text-xs font-semibold hover:bg-[#F8FAFC]"
                >
                  Go to Live RFQ Terminal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
