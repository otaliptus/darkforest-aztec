import {
  canActivateArtifact,
  canDepositArtifact,
  durationUntilArtifactAvailable,
  isActivated,
  isLocatable,
} from '@darkforest_eth/gamelogic';
import {
  isUnconfirmedActivateArtifactTx,
  isUnconfirmedDeactivateArtifactTx,
  isUnconfirmedDepositArtifactTx,
} from '@darkforest_eth/serde';
import { Artifact, ArtifactId, ArtifactType, LocationId, TooltipName } from '@darkforest_eth/types';
import React, { useCallback } from 'react';
import { Btn } from '../../Components/Btn';
import { Spacer } from '../../Components/CoreUI';
import { ArtifactRarityLabelAnim } from '../../Components/Labels/ArtifactLabels';
import { LoadingSpinner } from '../../Components/LoadingSpinner';
import { Sub } from '../../Components/Text';
import {
  useAccount,
  useArtifact,
  usePlanet,
  usePlanetArtifacts,
  useUIManager,
} from '../../Utils/AppHooks';
import { useEmitterValue } from '../../Utils/EmitterHooks';
import { TooltipTrigger, TooltipTriggerProps } from '../Tooltip';

export function ArtifactActions({
  artifactId,
  depositOn,
}: {
  artifactId: ArtifactId;
  depositOn?: LocationId;
}) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);
  const currentBlockNumber = useEmitterValue(uiManager.getEthConnection().blockNumber$, undefined);
  const artifactWrapper = useArtifact(uiManager, artifactId);
  const artifact = artifactWrapper.value;

  const depositPlanetWrapper = usePlanet(uiManager, depositOn);
  const onPlanetWrapper = usePlanet(uiManager, artifact?.onPlanetId);
  const depositPlanet = depositPlanetWrapper.value;
  const onPlanet = onPlanetWrapper.value;

  const otherArtifactsOnPlanet = usePlanetArtifacts(onPlanetWrapper, uiManager);

  const deposit = useCallback(
    (artifact: Artifact) => {
      artifact &&
        depositPlanetWrapper.value &&
        uiManager.depositArtifact(depositPlanetWrapper.value.locationId, artifact?.id);
    },
    [uiManager, depositPlanetWrapper.value]
  );

  const activate = useCallback(
    async (artifact: Artifact) => {
      if (onPlanet && isLocatable(onPlanet)) {
        let targetPlanetId = undefined;

        if (artifact.artifactType === ArtifactType.Wormhole) {
          const targetPlanet = await uiManager.startWormholeFrom(onPlanet);
          targetPlanetId = targetPlanet?.locationId;
        }

        uiManager.activateArtifact(onPlanet.locationId, artifact.id, targetPlanetId);
      }
    },
    [onPlanet, uiManager]
  );

  const deactivate = useCallback(
    (artifact: Artifact) => {
      onPlanet && uiManager.deactivateArtifact(onPlanet.locationId, artifact.id);
    },
    [onPlanet, uiManager]
  );

  if (!artifact || (!onPlanet && !depositPlanet) || !account) return null;

  const actions: TooltipTriggerProps[] = [];

  const depositing = artifact.transactions?.hasTransaction(isUnconfirmedDepositArtifactTx);
  const activating = artifact.transactions?.hasTransaction(isUnconfirmedActivateArtifactTx);
  const deactivating = artifact.transactions?.hasTransaction(isUnconfirmedDeactivateArtifactTx);

  const canHandleDeposit =
    depositPlanetWrapper.value && depositPlanetWrapper.value.planetLevel > artifact.rarity;

  const wait =
    artifact && currentBlockNumber !== undefined
      ? durationUntilArtifactAvailable(artifact, currentBlockNumber)
      : 0;

  if (canDepositArtifact(account, artifact, depositPlanetWrapper.value)) {
    actions.unshift({
      name: TooltipName.DepositArtifact,
      extraContent: !canHandleDeposit && (
        <>
          . <ArtifactRarityLabelAnim rarity={artifact.rarity} />
          {` artifacts can only be deposited on level ${artifact.rarity + 1}+ spacetime rips`}
        </>
      ),
      children: (
        <Btn
          disabled={depositing}
          onClick={(e) => {
            e.stopPropagation();
            canHandleDeposit && deposit(artifact);
          }}
        >
          {depositing ? <LoadingSpinner initialText={'Depositing...'} /> : 'Deposit'}
        </Btn>
      ),
    });
  }
  if (isActivated(artifact) && artifact.artifactType !== ArtifactType.BlackDomain) {
    actions.unshift({
      name: TooltipName.DeactivateArtifact,
      children: (
        <Btn
          disabled={deactivating}
          onClick={(e) => {
            e.stopPropagation();
            deactivate(artifact);
          }}
        >
          {deactivating ? <LoadingSpinner initialText={'Deactivating...'} /> : 'Deactivate'}
        </Btn>
      ),
    });
  }
  if (canActivateArtifact(artifact, onPlanet, otherArtifactsOnPlanet, currentBlockNumber ?? 0)) {
    actions.unshift({
      name: TooltipName.ActivateArtifact,
      children: (
        <Btn
          disabled={activating}
          onClick={(e) => {
            e.stopPropagation();
            activate(artifact);
          }}
        >
          {activating ? <LoadingSpinner initialText={'Activating...'} /> : 'Activate'}
        </Btn>
      ),
    });
  }

  if (wait > 0) {
    actions.unshift({
      name: TooltipName.Empty,
      extraContent: <>You have to wait before activating an artifact again</>,
      children: <Sub>{`${wait}B`}</Sub>,
    });
  }

  return (
    <div>
      {actions.length > 0 && <Spacer height={4} />}
      {actions.map((a, i) => (
        <span key={i}>
          <TooltipTrigger {...a} />
          <Spacer width={4} />
        </span>
      ))}
    </div>
  );
}
