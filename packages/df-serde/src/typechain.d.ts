declare module '@darkforest_eth/contracts/typechain' {
  export interface DarkForest {
    planets: (...args: unknown[]) => Promise<any>;
    planetsExtendedInfo: (...args: unknown[]) => Promise<any>;
    planetsExtendedInfo2: (...args: unknown[]) => Promise<any>;
    getDefaultStats: (...args: unknown[]) => Promise<any[]>;
    getArtifactPointValues: (...args: unknown[]) => Promise<any>;
    getArtifactById: (...args: unknown[]) => Promise<any>;
    revealedCoords: (...args: unknown[]) => Promise<any>;
    players: (...args: unknown[]) => Promise<any>;
    getPlanetArrival: (...args: unknown[]) => Promise<any>;
    getUpgrades: (...args: unknown[]) => Promise<any[][]>;
  }
}
