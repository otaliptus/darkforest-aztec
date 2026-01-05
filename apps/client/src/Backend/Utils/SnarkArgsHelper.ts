import { TerminalHandle } from '../../Frontend/Views/Terminal';
import { HashConfig } from '../../_types/global/GlobalTypes';

class SnarkArgsHelper {
  private readonly terminal: React.MutableRefObject<TerminalHandle | undefined>;

  private constructor(
    _hashConfig: HashConfig,
    terminal: React.MutableRefObject<TerminalHandle | undefined>
  ) {
    this.terminal = terminal;
  }

  static create(
    hashConfig: HashConfig,
    terminal: React.MutableRefObject<TerminalHandle | undefined>,
    _fakeHash = false
  ): SnarkArgsHelper {
    return new SnarkArgsHelper(hashConfig, terminal);
  }

  setSnarkCacheSize(_size: number) {
    return;
  }

  async getRevealArgs(x: number, y: number): Promise<unknown[]> {
    return [x, y];
  }

  async getInitArgs(x: number, y: number, r: number): Promise<unknown[]> {
    return [x, y, r];
  }

  async getMoveArgs(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    radius: number,
    distMax: number
  ): Promise<unknown[]> {
    return [x1, y1, x2, y2, radius, distMax];
  }

  async getFindArtifactArgs(x: number, y: number): Promise<unknown[]> {
    return [x, y];
  }
}

export default SnarkArgsHelper;
