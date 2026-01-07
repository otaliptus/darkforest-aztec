import { isUnconfirmedRevealTx } from '@darkforest_eth/serde';
import { EthAddress, LocationId } from '@darkforest_eth/types';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Btn } from '../Components/Btn';
import { CenterBackgroundSubtext, Spacer } from '../Components/CoreUI';
import { LoadingSpinner } from '../Components/LoadingSpinner';
import { Blue, White } from '../Components/Text';
import dfstyles from '../Styles/dfstyles';
import { usePlanet, useUIManager } from '../Utils/AppHooks';
import { useEmitterValue } from '../Utils/EmitterHooks';
import { ModalHandle } from '../Views/ModalPane';

const BroadcastWrapper = styled.div`
  & .row {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    & > span {
      &:first-child {
        color: ${dfstyles.colors.subtext};
        padding-right: 1em;
      }
    }
  }
  & .message {
    margin: 1em 0;

    & p {
      margin: 0.5em 0;

      &:last-child {
        margin-bottom: 1em;
      }
    }
  }
`;

export function BroadcastPaneHelpContent() {
  return (
    <div>
      Reveal this planet's location to all other players on-chain!
      <Spacer height={8} />
      Broadcasting can be a potent offensive tactic! Reveal a powerful enemy's location, and maybe
      someone else will take care of them for you?
    </div>
  );
}

export function BroadcastPane({
  initialPlanetId,
  modal: _modal,
}: {
  modal: ModalHandle;
  initialPlanetId: LocationId | undefined;
}) {
  const uiManager = useUIManager();
  const planetId = useEmitterValue(uiManager.selectedPlanetId$, initialPlanetId);
  const planet = usePlanet(uiManager, planetId).value;

  const getLoc = () => {
    if (!planet || !uiManager) return { x: 0, y: 0 };
    const loc = uiManager.getLocationOfPlanet(planet.locationId);
    if (!loc) return { x: 0, y: 0 };
    return loc.coords;
  };

  const broadcast = () => {
    if (!planet || !uiManager) return;
    const loc = uiManager.getLocationOfPlanet(planet.locationId);
    if (!loc) return;

    uiManager.revealLocation(loc.hash);
  };

  const [account, setAccount] = useState<EthAddress | undefined>(undefined); // consider moving this one to parent
  const isRevealed = planet?.coordsRevealed;
  const currentBlockNumber = useEmitterValue(uiManager.getEthConnection().blockNumber$, undefined);
  const nextBroadcastBlock = uiManager.getNextBroadcastAvailableTimestamp();
  const blocksLeft =
    currentBlockNumber !== undefined
      ? Math.max(0, nextBroadcastBlock - currentBlockNumber)
      : undefined;
  const broadcastCooldownPassed = blocksLeft === undefined ? true : blocksLeft <= 0;
  const currentlyBroadcastingAnyPlanet = uiManager.isCurrentlyRevealing();

  useEffect(() => {
    if (!uiManager) return;
    setAccount(uiManager.getAccount());
  }, [uiManager]);

  let revealBtn = undefined;

  if (isRevealed) {
    revealBtn = <Btn disabled={true}>Broadcast Coordinates</Btn>;
  } else if (planet?.transactions?.hasTransaction(isUnconfirmedRevealTx)) {
    revealBtn = (
      <Btn disabled={true}>
        <LoadingSpinner initialText={'Broadcasting...'} />
      </Btn>
    );
  } else if (!broadcastCooldownPassed) {
    revealBtn = <Btn disabled={true}>Broadcast Coordinates</Btn>;
  } else {
    revealBtn = (
      <Btn disabled={currentlyBroadcastingAnyPlanet} onClick={broadcast}>
        Broadcast Coordinates
      </Btn>
    );
  }

  const warningsSection = (
    <div>
      {currentlyBroadcastingAnyPlanet && (
        <p>
          <Blue>INFO:</Blue> Revealing...
        </p>
      )}
      {planet?.owner === account && (
        <p>
          <Blue>INFO:</Blue> You own this planet! Revealing its location is a dangerous flex.
        </p>
      )}
      {isRevealed && (
        <p>
          <Blue>INFO:</Blue> This planet's location is already revealed, and can't be revealed
          again!
        </p>
      )}
      {!broadcastCooldownPassed && (
        <p>
          <Blue>INFO:</Blue> You must wait{' '}
          <White>{blocksLeft === undefined ? '...' : `${blocksLeft}B`}</White> to reveal another
          planet.
        </p>
      )}
    </div>
  );

  if (planet) {
    return (
      <BroadcastWrapper>
        <div>
          You can broadcast a planet to publically reveal its location on the map. You can only
          broadcast a planet's location once every{' '}
          <White>{uiManager.contractConstants.LOCATION_REVEAL_COOLDOWN} blocks</White>.
        </div>
        <div className='message'>{warningsSection}</div>
        <div className='row'>
          <span>Coordinates</span>
          <span>{`(${getLoc().x}, ${getLoc().y})`}</span>
        </div>
        <Spacer height={8} />
        <p style={{ textAlign: 'right' }}>{revealBtn}</p>
      </BroadcastWrapper>
    );
  } else {
    return (
      <CenterBackgroundSubtext width='100%' height='75px'>
        Select a Planet
      </CenterBackgroundSubtext>
    );
  }
}
