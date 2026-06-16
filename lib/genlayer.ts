import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import type { Address } from 'genlayer-js/types'
import { CONTRACT_ADDRESS, TX_POLL_INTERVAL_MS, TX_TIMEOUT_MS, BRADBURY_CHAIN_ID } from './config'

// Fix Bradbury node's string JSON-RPC IDs to integers (viem compatibility)
const bradburyFetch: typeof fetch = async (input, init) => {
  if (init?.body && typeof init.body === 'string') {
    try {
      const parsed = JSON.parse(init.body)
      if (Array.isArray(parsed)) {
        init = { ...init, body: JSON.stringify(parsed.map(r => ({ ...r, id: typeof r.id === 'string' ? parseInt(r.id, 10) || 1 : r.id ?? 1 }))) }
      } else if (parsed && typeof parsed === 'object') {
        init = { ...init, body: JSON.stringify({ ...parsed, id: typeof parsed.id === 'string' ? parseInt(parsed.id, 10) || 1 : parsed.id ?? 1 }) }
      }
    } catch {}
  }
  return fetch(input, init)
}

const bradburyChain = { ...testnetBradbury, rpcUrls: { default: { http: ['https://rpc-bradbury.genlayer.com'] } } } as any

// ---------------------------------------------------------------------------
// getActiveProvider — finds the EIP-1193 provider that owns `address`
// Checks every known wallet namespace so OKX, MetaMask, Coinbase, Trust,
// Rabby, Brave, and WalletConnect-injected wallets all work correctly.
// ---------------------------------------------------------------------------
async function getActiveProvider(address: string): Promise<any> {
  const win = window as any
  const addr = address.toLowerCase()

  // All candidate providers to check, in priority order
  const candidates: any[] = []

  // OKX Wallet — injects as window.okxwallet (its own namespace)
  if (win.okxwallet) candidates.push(win.okxwallet)

  // EIP-6963 multi-provider array (modern standard — multiple wallets coexist)
  if (Array.isArray(win.ethereum?.providers)) {
    candidates.push(...win.ethereum.providers)
  }

  // Standard window.ethereum (MetaMask, Rabby, Brave, Coinbase, etc.)
  if (win.ethereum && !candidates.includes(win.ethereum)) {
    candidates.push(win.ethereum)
  }

  // Coinbase Wallet dedicated namespace
  if (win.coinbaseWalletExtension && !candidates.includes(win.coinbaseWalletExtension)) {
    candidates.push(win.coinbaseWalletExtension)
  }

  // Trust Wallet
  if (win.trustwallet && !candidates.includes(win.trustwallet)) {
    candidates.push(win.trustwallet)
  }

  // Find the provider that actually holds the connected address
  for (const provider of candidates) {
    try {
      const accounts: string[] = await provider.request({ method: 'eth_accounts' })
      if (accounts.some((a: string) => a.toLowerCase() === addr)) {
        return provider
      }
    } catch {}
  }

  // Fallback: return first available provider even if account check failed
  // (handles edge cases where eth_accounts returns empty but wallet is connected)
  if (candidates.length > 0) return candidates[0]

  throw new Error('No wallet found. Please connect MetaMask, OKX Wallet, or another EVM wallet.')
}

// ---------------------------------------------------------------------------
// ensureBradbury — switches/adds the Bradbury chain on the active provider
// ---------------------------------------------------------------------------
async function ensureBradbury(provider: any): Promise<void> {
  const current = await provider.request({ method: 'eth_chainId' })
  if (current === BRADBURY_CHAIN_ID) return
  try {
    await provider.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BRADBURY_CHAIN_ID }] })
  } catch (e: any) {
    // 4902 = chain not added; -32603 = some wallets use this instead
    if (e?.code === 4902 || e?.code === -32603) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: BRADBURY_CHAIN_ID,
          chainName: 'GenLayer Bradbury Testnet',
          nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 },
          rpcUrls: ['https://rpc-bradbury.genlayer.com'],
          blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'],
        }],
      })
    } else {
      throw e
    }
  }
}

export function getReadClient() {
  return createClient({ chain: bradburyChain, fetch: bradburyFetch } as any)
}

export function getBrowserClient(address: string) {
  return createClient({ chain: bradburyChain, account: address, fetch: bradburyFetch } as any)
}

export interface TxResult {
  success: boolean
  statusName: string
  txExecutionResultName: string
  txHash?: string
  error?: string
}

export async function waitForTx(client: any, txHash: string): Promise<TxResult> {
  const deadline = Date.now() + TX_TIMEOUT_MS
  let lastStatus = 'PENDING'
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, TX_POLL_INTERVAL_MS))
    try {
      const receipt = await client.getTransactionReceipt({ hash: txHash } as any)
      if (!receipt) continue
      const r = receipt as any
      const statusName: string = r.statusName ?? r.status ?? 'UNKNOWN'
      const execResult: string = r.txExecutionResultName ?? r.executionResult ?? ''
      lastStatus = statusName
      const isTerminal = ['ACCEPTED', 'FINALIZED'].some(s => statusName.toUpperCase().includes(s))
      const isError = ['UNDETERMINED'].some(s => statusName.toUpperCase().includes(s))
      if (isTerminal || isError) {
        const success = isTerminal && !statusName.toUpperCase().includes('ERROR') && execResult !== 'FINISHED_WITH_ERROR' && execResult !== 'ERROR'
        return { success, statusName, txExecutionResultName: execResult, txHash, error: success ? undefined : `${statusName} / ${execResult}` }
      }
    } catch {}
  }
  return { success: false, statusName: lastStatus, txExecutionResultName: 'TIMEOUT', error: 'Timed out' }
}

export async function readContract(method: string, args: unknown[] = []) {
  const client = getReadClient()
  return (client as any).readContract({ address: CONTRACT_ADDRESS as Address, functionName: method, args })
}

export async function writeContractWithWallet(address: string, method: string, args: unknown[] = []): Promise<TxResult> {
  if (!address) {
    return { success: false, statusName: 'ERROR', txExecutionResultName: 'ERROR', error: 'No wallet connected. Please connect your wallet and try again.' }
  }

  let provider: any
  try {
    provider = await getActiveProvider(address)
  } catch (e: any) {
    return { success: false, statusName: 'ERROR', txExecutionResultName: 'ERROR', error: e?.message ?? 'Could not find wallet provider.' }
  }

  try {
    await ensureBradbury(provider)
  } catch (e: any) {
    return { success: false, statusName: 'ERROR', txExecutionResultName: 'ERROR', error: `Chain switch failed: ${e?.message ?? String(e)}` }
  }

  // Temporarily set window.ethereum to the active provider so genlayer-js
  // picks up the correct signer regardless of which wallet is connected
  const win = window as any
  const savedEthereum = win.ethereum
  win.ethereum = provider

  try {
    const client = getBrowserClient(address)
    const txHash = await (client as any).writeContract({
      address: CONTRACT_ADDRESS as Address,
      functionName: method,
      args,
    })
    return await waitForTx(client, txHash as string)
  } catch (e: any) {
    return { success: false, statusName: 'ERROR', txExecutionResultName: 'ERROR', error: e?.message ?? String(e) }
  } finally {
    // Always restore window.ethereum
    win.ethereum = savedEthereum
  }
}
