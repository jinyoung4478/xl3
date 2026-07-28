import React, { useCallback, useState } from 'react';
import Translate from '@docusaurus/Translate';
import { resetConsent } from '@site/src/lib/posthog';
import useConsentStatus from '@site/src/lib/useConsent';
import styles from './ConsentReset.module.css';

/**
 * Withdraw-consent control for the privacy page.
 *
 * GDPR requires withdrawing consent to be as easy as giving it, and the banner
 * is gone once a choice is made — this is the way back. Clearing the stored
 * choice returns PostHog to 'pending', which re-arms the banner immediately.
 */
export default function ConsentReset(): React.ReactNode {
  const status = useConsentStatus();
  // Distinguishes "you just cleared your choice" from "you have not chosen
  // yet". Both are 'pending', but a first-time visitor is already looking at
  // the banner and should not be told anything was reset.
  const [justReset, setJustReset] = useState(false);

  const reset = useCallback(() => {
    resetConsent();
    setJustReset(true);
  }, []);

  // Null on builds with no API key — the SDK never loads and there is nothing
  // to withdraw.
  if (status === null) {
    return null;
  }

  if (justReset) {
    return (
      <p className={styles.done}>
        <Translate
          id="consent.reset.pending"
          description="Shown on the privacy page once the stored consent choice has been cleared"
        >
          Your choice has been cleared. The consent notice is showing again.
        </Translate>
      </p>
    );
  }

  if (status === 'pending') {
    return null;
  }

  return (
    <p>
      <button type="button" className={styles.button} onClick={reset}>
        {status === 'granted' ? (
          <Translate
            id="consent.reset.withdraw"
            description="Privacy page button shown to visitors who accepted cookies"
          >
            Withdraw cookie consent
          </Translate>
        ) : (
          <Translate
            id="consent.reset.change"
            description="Privacy page button shown to visitors who declined cookies"
          >
            Change my cookie choice
          </Translate>
        )}
      </button>
    </p>
  );
}
