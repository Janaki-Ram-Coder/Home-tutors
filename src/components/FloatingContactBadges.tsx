import React, { useEffect, useState } from 'react';
import { instituteInfo } from '../data/instituteData';

interface FloatingContactBadgesProps {
  isHidden?: boolean;
}

export const FloatingContactBadges: React.FC<FloatingContactBadgesProps> = ({
  isHidden = false,
}) => {
  const [hasActiveDialogPopup, setHasActiveDialogPopup] = useState(false);

  // Automatically hide floating badges whenever any modal/dialog popup is open
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const checkDialogs = () => {
      const openDialog = document.querySelector('[role="dialog"][aria-modal="true"]');
      setHasActiveDialogPopup(Boolean(openDialog));
    };

    checkDialogs();

    const observer = new MutationObserver(() => {
      checkDialogs();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['role', 'aria-modal'],
    });

    return () => observer.disconnect();
  }, []);

  if (isHidden || hasActiveDialogPopup) {
    return null;
  }

  const whatsappUrl = `https://wa.me/${instituteInfo.whatsappNumber}?text=${encodeURIComponent(
    'Hello Kumari Institute, I would like to enquire about home tuition and coaching classes.'
  )}`;

  return (
    <div
      id="floating-contact-badges"
      className="fixed right-3.5 sm:right-5 bottom-[84px] lg:bottom-6 z-40 flex flex-col items-end gap-3.5 pointer-events-none"
    >
      {/* 1. WHATSAPP ICON BADGE (Top badge matching attached UI) */}
      <a
        id="floating-whatsapp-badge"
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Chat on WhatsApp (${instituteInfo.phone})`}
        title={`WhatsApp: ${instituteInfo.phone}`}
        className="group pointer-events-auto relative flex items-center gap-2.5 focus:outline-none"
      >
        {/* Desktop Hover Label */}
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/90 text-white text-xs font-bold shadow-lg border border-emerald-400/30 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-[#25D366]" />
          <span>WhatsApp • {instituteInfo.phone}</span>
        </span>

        {/* Clean Green Circular WhatsApp Badge with Soft Ambient Shadow */}
        <div className="relative w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-full bg-[#22c55e] bg-gradient-to-br from-[#2ad167] via-[#22c55e] to-[#1ab354] shadow-[0_8px_22px_rgba(34,197,94,0.42),0_3px_8px_rgba(0,0,0,0.12)] flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <svg
            viewBox="0 0 32 32"
            className="w-[38px] h-[38px] sm:w-[40px] sm:h-[40px]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M16 4.2C9.5 4.2 4.2 9.4 4.2 15.8c0 2.3.7 4.4 1.9 6.2L4.8 27l5.2-1.3c1.8 1 3.8 1.6 6 1.6 6.5 0 11.8-5.2 11.8-11.5C27.8 9.4 22.5 4.2 16 4.2zm0 21c-2 0-3.8-.6-5.4-1.6l-.4-.2-3.1.8.8-3-.3-.4c-1-1.5-1.5-3.2-1.5-5 0-5.3 4.4-9.5 9.9-9.5s9.9 4.3 9.9 9.5c0 5.2-4.4 9.4-9.9 9.4z"
              fill="#FFFFFF"
            />
            <path
              d="M21.25 18.4c-.29-.14-1.69-.83-1.95-.93-.26-.09-.45-.14-.64.14-.19.28-.74.93-.9 1.12-.17.19-.33.21-.62.07-.29-.14-1.21-.45-2.31-1.42-.85-.76-1.43-1.7-1.6-1.98-.17-.28-.02-.44.13-.58.13-.13.29-.33.43-.5.14-.17.19-.28.29-.47.09-.19.05-.36-.02-.5-.07-.14-.64-1.54-.88-2.11-.23-.55-.47-.48-.64-.49-.17-.01-.36-.01-.55-.01-.19 0-.5.07-.76.36-.26.28-1 1-1 2.43 0 1.43 1.02 2.81 1.17 3 .14.19 2.02 3.13 4.91 4.38.69.3 1.22.47 1.64.61.69.22 1.32.19 1.81.11.55-.08 1.69-.69 1.93-1.36.24-.67.24-1.24.17-1.36-.07-.12-.26-.19-.55-.33z"
              fill="#FFFFFF"
            />
          </svg>
        </div>
      </a>

      {/* 2. PHONE CALL ICON BADGE (Bottom badge positioned right above Bottom Nav Bar) */}
      <a
        id="floating-phone-badge"
        href={`tel:${instituteInfo.phoneClean}`}
        aria-label={`Call Kumari Institute (${instituteInfo.phone})`}
        title={`Call: ${instituteInfo.phone}`}
        className="group pointer-events-auto relative flex items-center gap-2.5 focus:outline-none"
      >
        {/* Desktop Hover Label */}
        <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-950/90 text-white text-xs font-bold shadow-lg border border-sky-400/30 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-sky-400" />
          <span>Call • {instituteInfo.phone}</span>
        </span>

        {/* Deep Blue Circle & Outlined Handset without outer border */}
        <div className="relative w-[54px] h-[54px] sm:w-[58px] sm:h-[58px] rounded-full bg-gradient-to-tr from-[#033262] via-[#064a8a] to-[#0a63b3] shadow-[0_8px_22px_rgba(3,50,98,0.38),0_3px_8px_rgba(0,0,0,0.16)] flex items-center justify-center transition-transform duration-200 group-hover:scale-105 group-active:scale-95">
          <svg
            viewBox="0 0 24 24"
            className="w-[26px] h-[26px] sm:w-[28px] sm:h-[28px]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M21 16.42v2.45a1.85 1.85 0 0 1-2.02 1.84 18.25 18.25 0 0 1-7.95-2.83 18 18 0 0 1-5.54-5.54 18.25 18.25 0 0 1-2.83-7.99A1.85 1.85 0 0 1 4.49 2.33h2.45a1.85 1.85 0 0 1 1.85 1.59c.12.88.33 1.75.65 2.58a1.85 1.85 0 0 1-.42 1.95l-1.04 1.04a14.8 14.8 0 0 0 5.54 5.54l1.04-1.04a1.85 1.85 0 0 1 1.95-.42c.83.32 1.7.53 2.58.65a1.85 1.85 0 0 1 1.91 1.8z"
              stroke="#cce5fa"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </a>
    </div>
  );
};
