import { EMPTY_ARTIFACT_ID } from '@darkforest_eth/constants';
import { ArtifactRarity, ArtifactType, Biome, RenderedArtifact } from '@darkforest_eth/types';
import {
  ARTIFACTS_THUMBS_URL,
  ARTIFACTS_URL,
  EMPTY_SPRITE,
  SPRITES_HORIZONTALLY,
  SPRITES_VERTICALLY,
  spriteFromArtifact,
} from '@darkforest_eth/renderer/dist/TextureManager';
import React, { useMemo } from 'react';
import styled from 'styled-components';

const Container = styled.div`
  width: fit-content;
  overflow-x: scroll;
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  width: fit-content;
`;

const basicArtifacts = Object.values(ArtifactType).filter(
  (type) => type >= ArtifactType.Monolith && type <= ArtifactType.Pyramid
);
const relicArtifacts = Object.values(ArtifactType).filter(
  (type) => type >= ArtifactType.Wormhole && type <= ArtifactType.BlackDomain
);

const knownTypes = Object.values(ArtifactType).filter((type) => type !== ArtifactType.Unknown);
const knownBiomes = Object.values(Biome).filter((biome) => biome !== Biome.UNKNOWN);
const knownRarities = Object.values(ArtifactRarity).filter(
  (rarity) => rarity !== ArtifactRarity.Unknown
);

function ArtifactPreviewer({
  type,
  biome,
  rarity,
  ancient,
  thumb,
}: {
  type: ArtifactType;
  biome: Biome;
  rarity: ArtifactRarity;
  ancient?: boolean;
  thumb: boolean;
}) {
  const artifact = useMemo(
    () =>
      ({
        artifactType: type,
        planetBiome: biome,
        rarity,
        id: EMPTY_ARTIFACT_ID,
      }) as RenderedArtifact,
    [type, biome, rarity]
  );
  const sprite = useMemo(() => spriteFromArtifact(artifact), [artifact]);
  const sheetUrl = thumb ? ARTIFACTS_THUMBS_URL : ARTIFACTS_URL;
  const size = 64;
  const sheetWidth = SPRITES_HORIZONTALLY * size;
  const sheetHeight = SPRITES_VERTICALLY * size;
  const hasSprite = sprite !== EMPTY_SPRITE && sprite.x1 >= 0 && sprite.y1 >= 0;
  const offsetX = hasSprite ? -sprite.x1 * sheetWidth : 0;
  const offsetY = hasSprite ? -sprite.y1 * sheetHeight : 0;
  const backgroundImage = hasSprite ? `url(${sheetUrl})` : 'none';

  return (
    <Sprite
      title={ancient ? 'Ancient' : 'Artifact'}
      style={{
        backgroundImage,
        backgroundSize: `${sheetWidth}px ${sheetHeight}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
      }}
    />
  );
}

const THUMB = false;
export function TestArtifactImages() {
  return (
    <Container>
      <h1>Artifacts</h1>
      {basicArtifacts.map((type) => (
        <div key={type}>
          {knownRarities.map((rarity) => (
            <Row key={rarity}>
              {knownBiomes.map((biome, i) => (
                <ArtifactPreviewer
                  key={i}
                  type={type}
                  biome={biome}
                  rarity={rarity}
                  thumb={THUMB}
                />
              ))}
            </Row>
          ))}
        </div>
      ))}
      <h1>Relics</h1>
      {relicArtifacts.map((type) => (
        <Row key={type}>
          {knownRarities.map((rarity, i) => (
            <ArtifactPreviewer
              key={i}
              type={type}
              biome={Biome.OCEAN}
              rarity={rarity}
              thumb={THUMB}
            />
          ))}
        </Row>
      ))}
      <h1>Ancient</h1>
      {knownTypes.map((type) => (
        <Row key={type}>
          {knownRarities.map((rarity, i) => (
            <ArtifactPreviewer
              key={i}
              type={type}
              biome={Biome.OCEAN}
              rarity={rarity}
              ancient
              thumb={THUMB}
            />
          ))}
        </Row>
      ))}
    </Container>
  );
}

const Sprite = styled.div`
  image-rendering: crisp-edges;
  background-repeat: no-repeat;
  width: 64px;
  height: 64px;
`;
