import React from 'react';
import styled from 'styled-components';
import dfstyles from '../Styles/dfstyles';

type PatienceDisclaimerProps = {
  className?: string;
};

const Container = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid ${dfstyles.colors.borderDark};
  border-radius: ${dfstyles.borderRadius};
  background: rgba(0, 0, 0, 0.35);
  color: ${dfstyles.colors.text};
  font-size: ${dfstyles.fontSizeXS};
  letter-spacing: 0.08em;
  text-transform: uppercase;
`;

const Emphasis = styled.strong`
  color: ${dfstyles.colors.dfyellow};
  font-weight: 700;
`;

export function PatienceDisclaimer({ className }: PatienceDisclaimerProps) {
  return (
    <Container className={className}>
      please be <Emphasis>very</Emphasis> patient
    </Container>
  );
}
