import {
  createPublicClient,
  createWalletClient,
  http,
  parseEventLogs,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';
import { withAttribution } from '@celo/attribution-tags';
import {
  CELO_MAINNET_CHAIN_ID,
  ERC8004_CONTRACTS,
  PROTOCOL_ENDPOINTS,
} from '@moi/shared-types';
import { resolveAttributionTagStatus } from '@moi/wallet-signer';

export const ERC8004_IDENTITY_ABI = [
  {
    type: 'function',
    name: 'register',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'agentURI', type: 'string' }],
    outputs: [{ name: 'agentId', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setAgentURI',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'newURI', type: 'string' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'tokenURI',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'event',
    name: 'Registered',
    inputs: [
      { name: 'agentId', type: 'uint256', indexed: true },
      { name: 'agentURI', type: 'string', indexed: false },
      { name: 'owner', type: 'address', indexed: true },
    ],
  },
] as const;

export interface Erc8004RegistrationDocument {
  type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1';
  name: string;
  description: string;
  image: string;
  capabilities: {
    takerRfq: boolean;
    passiveStitchFiller: boolean;
    x402Microservices: boolean;
  };
  financialWorkflows: string[];
  policyRestrictions: {
    mandatoryFirstTradeOwnerAuthorization: boolean;
    perTradeCapEnforced: boolean;
    dailySpendCapEnforced: boolean;
    minimumReservePreserved: boolean;
    cryptographicPolicyAttestationBound: boolean;
  };
  supportedNetwork: {
    name: string;
    chainId: number;
    caip2: string;
  };
  services: Array<{
    name: string;
    endpoint: string;
    version?: string;
  }>;
  x402Support: boolean;
  active: boolean;
  supportedTrust: string[];
  registrations: Array<{
    agentId: number;
    agentRegistry: string;
  }>;
  metadata: {
    operatorWallet: `0x${string}`;
    chainId: number;
    attributionTag?: string;
    supportedCorridors: string[];
    settlementReactor: `0x${string}`;
    fillerEngine: string;
  };
}

export function buildErc8004RegistrationDocument(params: {
  appUrl?: string;
  agentWallet: `0x${string}`;
  agentId?: number;
}): Erc8004RegistrationDocument {
  const baseUrl = (
    params.appUrl ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');

  const agentRegistryCaip = `eip155:${CELO_MAINNET_CHAIN_ID}:${ERC8004_CONTRACTS.mainnet.IdentityRegistry}`;

  return {
    type: 'https://eips.ethereum.org/EIPS/eip-8004#registration-v1',
    name: 'MOI Autonomous Treasury Agent',
    description:
      'Autonomous stablecoin treasury operating system on Celo Mainnet. Enforces deterministic risk mandates across Textile FX v2 RFQ corridors (cNGN, wARS, wBRL, wCOP, USDC, USAT <-> USDT), serves adaptive inventory-skewed quotes via textile-stitch, and reconciles onchain settlements via buy/x402.',
    image: `${baseUrl}/moi-logo.svg`,
    capabilities: {
      takerRfq: true,
      passiveStitchFiller: true,
      x402Microservices: true,
    },
    financialWorkflows: [
      'Textile FX v2 RFQ Conversion (cNGN -> USDT)',
      'Textile Stitch Inventory-Skewed Automated Market Making',
      'Agent-to-Agent Microservice Settlement via x402 / buy',
      'Double-Entry Asset Balance Reconciliation',
    ],
    policyRestrictions: {
      mandatoryFirstTradeOwnerAuthorization: true,
      perTradeCapEnforced: true,
      dailySpendCapEnforced: true,
      minimumReservePreserved: true,
      cryptographicPolicyAttestationBound: true,
    },
    supportedNetwork: {
      name: 'Celo Mainnet',
      chainId: CELO_MAINNET_CHAIN_ID,
      caip2: `eip155:${CELO_MAINNET_CHAIN_ID}`,
    },
    services: [
      {
        name: 'web',
        endpoint: baseUrl,
      },
      {
        name: 'A2A',
        endpoint: `${baseUrl}/api/identity/agent.json`,
        version: '1.0.0',
      },
      {
        name: 'textile-stitch-feed',
        endpoint: `${baseUrl}/api/pricing/stitch`,
        version: '2.0.0',
      },
      {
        name: 'wallet',
        endpoint: `eip155:${CELO_MAINNET_CHAIN_ID}:${params.agentWallet}`,
      },
    ],
    x402Support: true,
    active: true,
    supportedTrust: ['reputation'],
    registrations: params.agentId
      ? [
          {
            agentId: params.agentId,
            agentRegistry: agentRegistryCaip,
          },
        ]
      : [],
    metadata: {
      operatorWallet: params.agentWallet,
      chainId: CELO_MAINNET_CHAIN_ID,
      attributionTag: resolveAttributionTagStatus().configuredTag,
      supportedCorridors: [
        'cNGN/USDT',
        'wARS/USDT',
        'wBRL/USDT',
        'wCOP/USDT',
        'wMXN/USDT',
        'USDC/USDT',
        'USAT/USDT',
      ],
      settlementReactor: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3',
      fillerEngine: 'textile-stitch',
    },
  };
}

export class Erc8004IdentityService {
  private readonly rpcUrl: string;
  private readonly publicClient: any;

  constructor(rpcUrl?: string) {
    this.rpcUrl =
      rpcUrl || process.env.CELO_RPC_URL || 'https://forno.celo.org';
    this.publicClient = createPublicClient({
      chain: celo,
      transport: http(this.rpcUrl, { timeout: 12_000 }),
    });
  }

  /**
   * Reads an existing ERC-8004 Agent Identity from Celo Mainnet IdentityRegistry
   * (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`).
   */
  async inspectOnchainAgentIdentity(agentId: number): Promise<{
    exists: boolean;
    agentId: number;
    registryAddress: `0x${string}`;
    owner?: `0x${string}`;
    agentURI?: string;
    scanUrl: string;
    celoscanUrl: string;
  }> {
    const registryAddress = ERC8004_CONTRACTS.mainnet.IdentityRegistry;
    try {
      const [owner, agentURI] = await Promise.all([
        this.publicClient.readContract({
          address: registryAddress,
          abi: ERC8004_IDENTITY_ABI,
          functionName: 'ownerOf',
          args: [BigInt(agentId)],
        }),
        this.publicClient.readContract({
          address: registryAddress,
          abi: ERC8004_IDENTITY_ABI,
          functionName: 'tokenURI',
          args: [BigInt(agentId)],
        }),
      ]);
      return {
        exists: true,
        agentId,
        registryAddress,
        owner,
        agentURI,
        scanUrl: `${PROTOCOL_ENDPOINTS.scan8004}/agent/42220/${agentId}`,
        celoscanUrl: `${PROTOCOL_ENDPOINTS.celoscan}/token/${registryAddress}?a=${agentId}`,
      };
    } catch {
      return {
        exists: false,
        agentId,
        registryAddress,
        scanUrl: `${PROTOCOL_ENDPOINTS.scan8004}`,
        celoscanUrl: `${PROTOCOL_ENDPOINTS.celoscan}/address/${registryAddress}`,
      };
    }
  }

  /**
   * Registers MOI's Agent Identity on Celo Mainnet ERC-8004 IdentityRegistry
   * from the restricted agent wallet, tagged with the ERC-8021 attribution code.
   */
  async registerAgentOnchain(params: {
    agentURI: string;
    privateKey?: Hex;
    attributionCode?: string;
  }): Promise<{
    agentId: number;
    txHash: `0x${string}`;
    owner: `0x${string}`;
    registryAddress: `0x${string}`;
  }> {
    const key =
      params.privateKey ||
      (process.env.AGENT_SIGNER_SECRET_REFERENCE?.startsWith('0x')
        ? (process.env.AGENT_SIGNER_SECRET_REFERENCE as Hex)
        : undefined);

    if (!key) {
      throw new Error(
        'SIGNER_NOT_CONFIGURED: Set AGENT_SIGNER_SECRET_REFERENCE to register an ERC-8004 identity on Celo Mainnet.'
      );
    }

    const account = privateKeyToAccount(key);
    const attrStatus = resolveAttributionTagStatus({
      explicitTag: params.attributionCode,
    });

    const walletClient = createWalletClient({
      account,
      chain: celo,
      transport: http(this.rpcUrl),
    }).extend(withAttribution(attrStatus.configuredTag));

    const registryAddress = ERC8004_CONTRACTS.mainnet.IdentityRegistry;
    const { request } = await this.publicClient.simulateContract({
      account,
      address: registryAddress,
      abi: ERC8004_IDENTITY_ABI,
      functionName: 'register',
      args: [params.agentURI],
    });

    const txHash = await walletClient.writeContract(request);
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    const logs = parseEventLogs({
      abi: ERC8004_IDENTITY_ABI,
      eventName: 'Registered',
      logs: receipt.logs,
    });

    const mintedId = logs[0]?.args?.agentId ? Number(logs[0].args.agentId) : 0;

    return {
      agentId: mintedId,
      txHash,
      owner: account.address,
      registryAddress,
    };
  }
}

export * from './siwe-service';
export * from './session-service';
