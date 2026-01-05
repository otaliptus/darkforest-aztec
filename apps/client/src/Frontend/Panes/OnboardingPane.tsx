import { ModalName } from '@darkforest_eth/types';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { Btn } from '../Components/Btn';
import { Green, Red, White } from '../Components/Text';
import { TextPreview } from '../Components/TextPreview';
import dfstyles from '../Styles/dfstyles';
import { useAccount, useUIManager } from '../Utils/AppHooks';
import { ModalPane } from '../Views/ModalPane';

const StyledOnboardingContent = styled.div`
  width: 36em;
  height: 32em;
  position: relative;
  color: ${dfstyles.colors.text};

  .btn {
    position: absolute;
    right: 0.5em;
    bottom: 0.5em;
  }

  .indent {
    margin-left: 1em;
  }

  & > p,
  & > div {
    margin: 1em 0;
  }

  & > div {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
  }
`;

const enum OnboardState {
  Money,
  Storage,
  Keys,
  Help,
  Finished,
}

function OnboardMoney({ advance }: { advance: () => void }) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);

  return (
    <StyledOnboardingContent>
      <p>
        Welcome to <Green>Dark Forest</Green>!
      </p>
      <p>
        You are playing on an <White>Aztec test environment</White>. Transactions are signed by a
        local test account managed by the node.
      </p>
      <p className='indent'>
        Your current account address is: <br />
        <White>{account}</White>
      </p>
      <p>
        In production, account management and balances will be handled by your Aztec wallet.
      </p>
      <p>
        <White>Make sure you understand all of the above before proceeding.</White>
      </p>

      <div>
        <span></span>
        <Btn className='btn' onClick={advance}>
          I understand, please proceed.
        </Btn>
      </div>
    </StyledOnboardingContent>
  );
}

function OnboardStorage({ advance }: { advance: () => void }) {
  return (
    <StyledOnboardingContent>
      <p>
        The game stores important information like your <White>home coordinates</White> and{' '}
        <White>map data</White> in your browser's local storage/cache.
        <Red> If you clear your browser history, you risk losing your data!</Red>
      </p>
      <p>
        Your <White>home coordinates</White> act as your password. You can use them to access your
        Dark Forest account on other browsers, or to continue playing if you accidentally clear
        local storage. But this also means <Red>they should never be viewed by anyone else!</Red>
      </p>
      <p>
        <White>Make sure you back them up</White> and keep them somewhere safe.
      </p>
      <p>
        On the next page, you will be able to view and copy your home coordinates.{' '}
        <White>When you are ready to back them up, please proceed.</White>
      </p>
      <div>
        <span></span>
        <Btn className='btn' onClick={advance}>
          Proceed
        </Btn>
      </div>
    </StyledOnboardingContent>
  );
}
function OnboardKeys({ advance }: { advance: () => void }) {
  const uiManager = useUIManager();
  const account = useAccount(uiManager);

  const [home, setHome] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (!uiManager) return;
    const coords = uiManager.getHomeCoords();
    setHome(coords ? `(${coords.x}, ${coords.y})` : '');
  }, [uiManager]);

  return (
    <StyledOnboardingContent>
      <p>
        Your account address is: <br />
        <TextPreview text={account} focusedWidth={'150px'} unFocusedWidth={'150px'} />
      </p>
      <p>
        Your home coordinates are: <br />
        <White>{home}</White>
      </p>

      <p>
        Aztec test accounts are managed by the local node, so there is no browser-stored private
        key to back up.
      </p>
      <p>When you have backed up your coordinates, please proceed.</p>

      <div>
        <span></span>
        <Btn onClick={advance} className='btn'>
          Proceed
        </Btn>
      </div>
    </StyledOnboardingContent>
  );
}

function OnboardHelp({ advance }: { advance: () => void }) {
  return (
    <StyledOnboardingContent>
      <p>
        For an overview of how to play, rules, and scoring, click the question mark icon on the left
        to open the <White>Help Pane</White>.
      </p>
      <div>
        <span></span>
        <Btn onClick={advance} className='btn'>
          Proceed
        </Btn>
      </div>
    </StyledOnboardingContent>
  );
}

function OnboardFinished({ advance }: { advance: () => void }) {
  return (
    <StyledOnboardingContent>
      <p>That's all! You're now ready to play the game!</p>
      <p>
        We invite you to log into the universe. Click <White>Proceed</White> to join the world of{' '}
        <White>DARK FOREST...</White>
      </p>
      <div>
        <span></span>
        <Btn onClick={advance} className='btn'>
          Proceed
        </Btn>
      </div>
    </StyledOnboardingContent>
  );
}

export default function OnboardingPane({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const [onboardState, setOnboardState] = useState<OnboardState>(OnboardState.Money);

  const advance = () => setOnboardState((x) => x + 1);

  useEffect(() => {
    if (onboardState === OnboardState.Finished + 1) {
      onClose();
    }
  }, [onboardState, onClose]);

  return (
    <ModalPane
      id={ModalName.Onboarding}
      title={'Welcome to Dark Forest'}
      hideClose
      visible={visible}
      onClose={onClose}
    >
      {onboardState === OnboardState.Money && <OnboardMoney advance={advance} />}
      {onboardState === OnboardState.Storage && <OnboardStorage advance={advance} />}
      {onboardState === OnboardState.Keys && <OnboardKeys advance={advance} />}
      {onboardState === OnboardState.Help && <OnboardHelp advance={advance} />}
      {onboardState === OnboardState.Finished && <OnboardFinished advance={advance} />}
    </ModalPane>
  );
}
