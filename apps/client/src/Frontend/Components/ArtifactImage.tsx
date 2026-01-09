import { ArtifactFileColor } from '@darkforest_eth/gamelogic';
import { Artifact } from '@darkforest_eth/types';
import {
  ARTIFACTS_THUMBS_URL,
  ARTIFACTS_URL,
  EMPTY_SPRITE,
  SPRITES_HORIZONTALLY,
  SPRITES_VERTICALLY,
  spriteFromArtifact,
} from '@darkforest_eth/renderer/dist/TextureManager';
import React, { useMemo } from 'react';
import styled, { css } from 'styled-components';
import dfstyles from '../Styles/dfstyles';

export function ArtifactImage({
  artifact,
  size,
  thumb,
  bgColor,
}: {
  artifact: Artifact;
  size: number;
  thumb?: boolean;
  bgColor?: ArtifactFileColor;
}) {
  const sprite = useMemo(() => spriteFromArtifact(artifact), [artifact]);
  const sheetUrl = thumb ? ARTIFACTS_THUMBS_URL : ARTIFACTS_URL;
  const sheetWidth = SPRITES_HORIZONTALLY * size;
  const sheetHeight = SPRITES_VERTICALLY * size;
  const hasSprite = sprite !== EMPTY_SPRITE && sprite.x1 >= 0 && sprite.y1 >= 0;
  const offsetX = hasSprite ? -sprite.x1 * sheetWidth : 0;
  const offsetY = hasSprite ? -sprite.y1 * sheetHeight : 0;
  const backgroundImage = hasSprite ? `url(${sheetUrl})` : 'none';

  const image = (
    <SpriteFallback
      width={size}
      height={size}
      style={{
        backgroundImage,
        backgroundSize: `${sheetWidth}px ${sheetHeight}px`,
        backgroundPosition: `${offsetX}px ${offsetY}px`,
      }}
    />
  );

  return (
    <Container width={size} height={size}>
      {image}
    </Container>
  );
}

const Container = styled.div`
  image-rendering: crisp-edges;

  ${({ width, height }: { width: number; height: number }) => css`
    width: ${width}px;
    height: ${height}px;
    min-width: ${width}px;
    min-height: ${height}px;
    background-color: ${dfstyles.colors.artifactBackground};
    display: inline-block;
  `}
`;

const SpriteFallback = styled.div`
  image-rendering: crisp-edges;
  background-repeat: no-repeat;
  ${({ width, height }: { width: number; height: number }) => css`
    width: ${width}px;
    height: ${height}px;
  `}
`;
