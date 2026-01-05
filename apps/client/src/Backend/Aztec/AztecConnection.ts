import type { DiagnosticUpdater, EthAddress, GasPrices } from '@darkforest_eth/types';
import { monomitter, Monomitter } from '@darkforest_eth/events';
import { BigNumber } from 'ethers';
import type { Contract } from 'ethers';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import type { ClientConfig } from './config';
import { CLIENT_CONFIG } from './config';
import { connectDarkForest, type ClientLogFn, type DarkForestClient } from './scripts/darkforest';

type ProviderLike = {
  getBlock: (blockNumber: number) => Promise<{ timestamp: number; hash?: string } | undefined>;
};

export class AztecConnection {
  private client: DarkForestClient;
  private nodeUrl: string;
  private blockNumber = 0;
  private polling?: ReturnType<typeof setInterval>;
  private diagnosticsUpdater?: DiagnosticUpdater;
  private gasPrices: GasPrices = { slow: 0, average: 0, fast: 0 };

  public readonly blockNumber$: Monomitter<number>;
  public readonly myBalance$: Monomitter<BigNumber>;
  public readonly rpcChanged$: Monomitter<string>;
  public readonly gasPrices$: Monomitter<GasPrices>;

  private constructor(client: DarkForestClient, nodeUrl: string) {
    this.client = client;
    this.nodeUrl = nodeUrl;
    this.blockNumber$ = monomitter(true);
    this.myBalance$ = monomitter(true);
    this.rpcChanged$ = monomitter(true);
    this.gasPrices$ = monomitter(true);
    this.rpcChanged$.publish(nodeUrl);
    this.myBalance$.publish(BigNumber.from(0));
    this.gasPrices$.publish(this.gasPrices);
    this.startPolling();
  }

  static async connect(config: ClientConfig = CLIENT_CONFIG, log?: ClientLogFn) {
    const client = await connectDarkForest(config, log);
    return new AztecConnection(client, config.nodeUrl);
  }

  getNode(): AztecNode {
    return this.client.node;
  }

  getClient(): DarkForestClient {
    return this.client;
  }

  getAddress(): EthAddress | undefined {
    return this.client.account.address.toString() as EthAddress;
  }

  getCurrentBlockNumber(): number {
    return this.blockNumber;
  }

  getProvider(): ProviderLike {
    return {
      getBlock: async (blockNumber: number) => {
        const block = await this.client.node.getBlock(blockNumber);
        if (!block) return undefined;
        const timestamp = Number(block.timestamp);
        let hash: string | undefined;
        try {
          hash = (await block.hash()).toString();
        } catch {
          hash = undefined;
        }
        return { timestamp, hash };
      },
    };
  }

  getMyBalance(): BigNumber | undefined {
    return BigNumber.from(0);
  }

  getAutoGasPrices(): GasPrices {
    return { ...this.gasPrices };
  }

  getRpcEndpoint(): string {
    return this.nodeUrl;
  }

  async setRpcUrl(_rpcUrl: string): Promise<void> {
    throw new Error('Switching RPC endpoints is not supported in the Aztec client.');
  }

  async setAccount(_skey: string): Promise<void> {
    throw new Error('Setting Ethereum accounts is not supported in the Aztec client.');
  }

  async loadContract<T extends Contract>(..._args: unknown[]): Promise<T> {
    throw new Error('Ethereum contracts are not supported in the Aztec client.');
  }

  async loadBalance(_address?: EthAddress): Promise<BigNumber> {
    return BigNumber.from(0);
  }

  setDiagnosticUpdater(diagnosticUpdater?: DiagnosticUpdater) {
    this.diagnosticsUpdater = diagnosticUpdater;
  }

  async signMessageObject(_payload?: unknown): Promise<never> {
    throw new Error('signMessageObject is not supported for Aztec accounts.');
  }

  async signMessage(): Promise<never> {
    throw new Error('signMessage is not supported for Aztec accounts.');
  }

  getPrivateKey(): never {
    throw new Error('getPrivateKey is not supported for Aztec accounts.');
  }

  async stop() {
    if (this.polling) clearInterval(this.polling);
    await this.client.stop?.();
  }

  private startPolling() {
    this.polling = setInterval(() => {
      this.refreshBlockNumber().catch(() => {
        // ignore polling errors; UI will retry on next tick
      });
    }, 2000);
  }

  private async refreshBlockNumber() {
    const next = Number(await this.client.node.getBlockNumber());
    if (next !== this.blockNumber) {
      this.blockNumber = next;
      this.blockNumber$.publish(next);
    }
  }
}
