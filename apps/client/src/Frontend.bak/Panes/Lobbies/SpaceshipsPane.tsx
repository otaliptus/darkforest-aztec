// @ts-nocheck
import React from 'react';
import { Spacer } from '../../Components/CoreUI';
import { Checkbox, DarkForestCheckbox } from '../../Components/Input';
import { LobbiesPaneProps } from './LobbiesUtils';

const SPACESHIP_KEYS = ['GEAR', 'MOTHERSHIP', 'TITAN', 'CRESCENT', 'WHALE'] as const;
type SpaceshipKey = typeof SPACESHIP_KEYS[number];

export function SpaceshipsPane({ config, onUpdate }: LobbiesPaneProps) {
  return (
    <>
      <div>
        Turn on or off whether the game gives each player one of each of these spaceships on their
        home planet.
        <Spacer height={12} />
      </div>
      {SPACESHIP_KEYS.map((ship) => (
        <ToggleSpaceship config={config} onUpdate={onUpdate} spaceship={ship} key={ship} />
      ))}
    </>
  );
}

function ToggleSpaceship({
  config,
  onUpdate,
  spaceship,
}: LobbiesPaneProps & { spaceship: SpaceshipKey }) {
  const spaceshipsConfig =
    (config as any).SPACESHIPS?.displayValue ?? (config as any).SPACESHIPS?.currentValue ?? {};
  const spaceshipsCurrent = (config as any).SPACESHIPS?.currentValue ?? {};
  return (
    <Checkbox
      label={`enable ${spaceship}`}
      checked={spaceshipsConfig[spaceship]}
      onChange={(e: Event & React.ChangeEvent<DarkForestCheckbox>) => {
        onUpdate({
          type: 'SPACESHIPS',
          value: {
            ...spaceshipsCurrent,
            [spaceship]: e.target.checked,
          },
        });
      }}
    />
  );
}
