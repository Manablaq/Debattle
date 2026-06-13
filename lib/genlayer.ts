import { createClient } from 'genlayer-js'
import { testnetBradbury } from 'genlayer-js/chains'
import type { Address } from 'genlayer-js/types'
import { CONTRACT_ADDRESS, TX_POLL_INTERVAL_MS, TX_TIMEOUT_MS, BRADBURY_CHAIN_ID } from './config'

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

async function ensureBradbury(): Promise<void> {
  const win = window as any
  if (!win.ethereum) throw new Error('No wallet found. Please install MetaMask.')
  const current = await win.ethereum.request({ method: 'eth_chainId' })
  if (current === BRADBURY_CHAIN_ID) return
  try {
    await win.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: BRADBURY_CHAIN_ID }] })
  } catch (e: any) {
    if (e.code === 4902) {
      await win.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [{ chainId: BRADBURY_CHAIN_ID, chainName: 'GenLayer Bradbury Testnet', nativeCurrency: { name: 'GEN', symbol: 'GEN', decimals: 18 }, rpcUrls: ['https://rpc-bradbury.genlayer.com'], blockExplorerUrls: ['https://explorer-bradbury.genlayer.com'] }]
      })
    } else throw e
  }
}

export function getReadClient() {
  return createClient({ chain: bradburyChain, fetch: bradburyFetch } as any)
}

export function getBrowserClient(address: string) {
  return createClient({ chain: bradburyChain, account: address, fetch: bradburyFetch } as any)
}

export interface TxResult {
  success: boolean; statusName: string; txExecutionResultName: string; txHash?: string; error?: string
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
  await ensureBradbury()
  const client = getBrowserClient(address)
  try {
    const txHash = await (client as any).writeContract({ address: CONTRACT_ADDRESS as Address, functionName: method, args })
    return await waitForTx(client, txHash as string)
  } catch (e: any) {
    return { success: false, statusName: 'ERROR', txExecutionResultName: 'ERROR', error: e?.message ?? String(e) }
  }
}
