export type PlanetId = string;
export type ArtifactId = string;

export type Coordinates = {
    x: number;
    y: number;
};

export type PlanetDiscovery = {
    id: PlanetId;
    coords: Coordinates;
};
