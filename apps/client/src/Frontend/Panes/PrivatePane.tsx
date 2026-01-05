import { ModalName } from '@darkforest_eth/types';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Sub } from '../Components/Text';
import { TextPreview } from '../Components/TextPreview';
import { useAccount, useUIManager } from '../Utils/AppHooks';
import { ModalPane } from '../Views/ModalPane';

const StyledPrivatePane = styled.div`
  width: 36em;
  height: 10em;
  & > div {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
`;
export function PrivatePane({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);

  const [home, setHome] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!uiManager) return;
    const coords = uiManager.getHomeCoords();
    setHome(coords ? `(${coords.x}, ${coords.y})` : '');
  }, [uiManager]);
  return (
    <ModalPane
      id={ModalName.Private}
      title='View Account and Home Coords'
      visible={visible}
      onClose={onClose}
    >
      <StyledPrivatePane>
        <p>
          <Sub>
            <u>Account</u>
          </Sub>
        </p>
        <p>
          <TextPreview text={account} focusedWidth={'150px'} unFocusedWidth={'150px'} />
        </p>
        <br />
        <p>
          <Sub>
            <u>Home Coords</u>
          </Sub>
        </p>
        <p>{home}</p>
        <br />
        <p>
          <Sub>Secret key</Sub>: not available in the Aztec client.
        </p>
      </StyledPrivatePane>
    </ModalPane>
  );
}
