import { memo, useState } from 'react';
import ariaPortraitWebpUrl from '../assets/images/aria_silver_portrait_1794450731122.webp';
import ariaPortraitJpgUrl from '../assets/images/aria_silver_portrait_1794450731122.jpg';

interface AriaPortraitProps {
  size?: 'sm' | 'md' | 'lg';
  lowHp?: boolean;
}

export const AriaPortrait = memo(function AriaPortrait({
  size = 'md',
  lowHp = false,
}: AriaPortraitProps) {
  const [srcUrl, setSrcUrl] = useState(ariaPortraitWebpUrl);
  const [imgFailed, setImgFailed] = useState(false);

  const dimClass =
    size === 'sm' ? 'w-11 h-11' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';

  return (
    <div
      className={`relative shrink-0 ${dimClass} bg-[#0e1326] border ${
        lowHp ? 'border-[#f24a70]' : 'border-[#8fa5db]/60'
      } shadow-[0_4px_14px_rgba(3,5,12,0.85)] overflow-hidden`}
    >
      {!imgFailed ? (
        <img
          src={srcUrl}
          alt="银月剑士艾莉娅头像"
          decoding="async"
          onError={() => {
            if (srcUrl !== ariaPortraitJpgUrl) {
              setSrcUrl(ariaPortraitJpgUrl);
            } else {
              setImgFailed(true);
            }
          }}
          className="w-full h-full object-cover pixel-canvas"
        />
      ) : (
        <svg
          viewBox="0 0 32 32"
          className="w-full h-full bg-[#10162d]"
          aria-label="银月剑士艾莉娅像素徽章"
        >
          <rect width="32" height="32" fill="#10162d" />
          <rect x="8" y="6" width="16" height="10" fill="#d8e2f8" />
          <rect x="10" y="12" width="12" height="9" fill="#ffe4d6" />
          <rect x="12" y="15" width="3" height="3" fill="#8b68ff" />
          <rect x="18" y="15" width="3" height="3" fill="#8b68ff" />
          <rect x="7" y="21" width="18" height="9" fill="#1b2444" />
          <line x1="25" y1="5" x2="19" y2="29" stroke="#e8f3ff" strokeWidth="2" />
        </svg>
      )}
      {/* Corner gothic silver rivets */}
      <span className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l border-[#dce6ff]/80 pointer-events-none" />
      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 border-t border-r border-[#dce6ff]/80 pointer-events-none" />
      <span className="absolute bottom-0.5 left-0.5 w-1.5 h-1.5 border-b border-l border-[#dce6ff]/80 pointer-events-none" />
      <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r border-[#dce6ff]/80 pointer-events-none" />
    </div>
  );
});
