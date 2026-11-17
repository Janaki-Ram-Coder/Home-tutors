import { useEffect, useRef } from 'react';

/**
 * Syncs a transient UI modal / drawer with browser history so pressing
 * the mobile Back button cleanly dismisses the overlay instead of leaving
 * the current page, and closing via X/backdrop keeps history aligned.
 */
export function useBackButtonDismiss(
  isOpen: boolean,
  modalKey: string,
  onDismiss: () => void
): void {
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const prevOpenRef = useRef<boolean>(false);
  const closedByPopstateRef = useRef<boolean>(false);

  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = isOpen;

    if (isOpen && !wasOpen) {
      closedByPopstateRef.current = false;
      try {
        const currentState = window.history.state || {};
        if (currentState.__kumariSubModal !== modalKey) {
          window.history.pushState(
            {
              ...currentState,
              __kumariSubModal: modalKey,
            },
            ''
          );
        }
      } catch {
        // Ignore History API restriction if any
      }
    } else if (!isOpen && wasOpen) {
      if (!closedByPopstateRef.current) {
        try {
          if (window.history.state?.__kumariSubModal === modalKey) {
            window.history.back();
          }
        } catch {
          // Ignore
        }
      }
      closedByPopstateRef.current = false;
    }
  }, [isOpen, modalKey]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePopstate = () => {
      if (window.history.state?.__kumariSubModal !== modalKey) {
        closedByPopstateRef.current = true;
        onDismissRef.current();
      }
    };

    window.addEventListener('popstate', handlePopstate);
    return () => {
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [isOpen, modalKey]);
}
