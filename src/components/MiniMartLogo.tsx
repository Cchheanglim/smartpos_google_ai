import React from 'react';

interface MiniMartLogoProps {
  size?: number | string;
  className?: string;
  style?: React.CSSProperties;
  withRing?: boolean;
}

export const MiniMartLogo: React.FC<MiniMartLogoProps> = ({
  size = 38,
  className = '',
  style,
  withRing = false
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`mini-mart-logo-wrap ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: pixelSize,
        height: pixelSize,
        borderRadius: '50%',
        backgroundColor: '#FFFFFF',
        padding: '2px',
        boxShadow: withRing ? '0 0 0 2px rgba(184, 29, 36, 0.4), 0 2px 8px rgba(0, 0, 0, 0.15)' : '0 1px 3px rgba(0,0,0,0.12)',
        overflow: 'hidden',
        flexShrink: 0,
        ...style
      }}
    >
      <img
        src="/logo.svg"
        alt="UTET Mini Mart Logo"
        referrerPolicy="no-referrer"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block'
        }}
      />
    </div>
  );
};

export default MiniMartLogo;
