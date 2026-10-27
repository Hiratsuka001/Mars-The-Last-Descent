import React, { useEffect, useState } from 'react';

export type NovaMood = 'idle' | 'happy' | 'curious' | 'surprised' | 'scanning' | 'warning' | 'celebrate';

interface NovaAvatarProps {
  mood?: NovaMood;
  size?: number; // size in px
  showScannerBeam?: boolean;
  className?: string;
  onClick?: () => void;
}

export const NovaAvatar: React.FC<NovaAvatarProps> = ({
  mood = 'idle',
  size = 96,
  showScannerBeam = false,
  className = '',
  onClick
}) => {
  const [blink, setBlink] = useState(false);
  const [earTwitch, setEarTwitch] = useState(false);
  const [tailAngle, setTailAngle] = useState(0);

  // Natural idle behaviors
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 160);
    }, 3200 + Math.random() * 2000);

    const twitchInterval = setInterval(() => {
      setEarTwitch(true);
      setTimeout(() => setEarTwitch(false), 400);
    }, 4500 + Math.random() * 3000);

    let tailFrame = 0;
    const tailInterval = setInterval(() => {
      tailFrame += 0.08;
      setTailAngle(Math.sin(tailFrame) * 12);
    }, 50);

    return () => {
      clearInterval(blinkInterval);
      clearInterval(twitchInterval);
      clearInterval(tailInterval);
    };
  }, []);

  // Eye shape based on mood and blink
  const renderEyes = () => {
    if (blink) {
      return (
        <g stroke="#06b6d4" strokeWidth="2.5" strokeLinecap="round">
          <line x1="36" y1="46" x2="44" y2="46" />
          <line x1="56" y1="46" x2="64" y2="46" />
        </g>
      );
    }

    if (mood === 'happy' || mood === 'celebrate') {
      // Happy curved arcs (^_^)
      return (
        <g stroke="#38bdf8" strokeWidth="3" fill="none" strokeLinecap="round">
          <path d="M 35 47 Q 40 41 45 47" />
          <path d="M 55 47 Q 60 41 65 47" />
        </g>
      );
    }

    if (mood === 'surprised') {
      // Wide circular glowing eyes
      return (
        <g fill="#06b6d4">
          <circle cx="40" cy="45" r="6" />
          <circle cx="60" cy="45" r="6" />
          <circle cx="42" cy="43" r="2" fill="#ffffff" />
          <circle cx="62" cy="43" r="2" fill="#ffffff" />
        </g>
      );
    }

    if (mood === 'warning') {
      // Amber alert eyes
      return (
        <g fill="#f59e0b">
          <ellipse cx="40" cy="45" rx="5" ry="3.5" />
          <ellipse cx="60" cy="45" rx="5" ry="3.5" />
          <circle cx="41" cy="44" r="1.5" fill="#ffffff" />
          <circle cx="61" cy="44" r="1.5" fill="#ffffff" />
        </g>
      );
    }

    if (mood === 'scanning') {
      // Focused cyan visor slits with digital glow
      return (
        <g fill="#22d3ee">
          <rect x="35" y="44" width="10" height="4" rx="2" className="animate-pulse" />
          <rect x="55" y="44" width="10" height="4" rx="2" className="animate-pulse" />
          <circle cx="40" cy="46" r="1" fill="#ffffff" />
          <circle cx="60" cy="46" r="1" fill="#ffffff" />
        </g>
      );
    }

    // Default cute oversized eyes with glint
    return (
      <g>
        {/* Eye sockets shadow */}
        <ellipse cx="40" cy="45" rx="5.5" ry="6" fill="#0f172a" />
        <ellipse cx="60" cy="45" rx="5.5" ry="6" fill="#0f172a" />
        {/* Cyan Iris */}
        <ellipse cx="40" cy="45" rx="4.8" ry="5.2" fill="#06b6d4" />
        <ellipse cx="60" cy="45" rx="4.8" ry="5.2" fill="#06b6d4" />
        {/* Highlights */}
        <circle cx="38" cy="43" r="1.8" fill="#ffffff" />
        <circle cx="58" cy="43" r="1.8" fill="#ffffff" />
        <circle cx="42" cy="47" r="0.8" fill="#e0f2fe" />
        <circle cx="62" cy="47" r="0.8" fill="#e0f2fe" />
      </g>
    );
  };

  const leftEarRotation = earTwitch ? -14 : (mood === 'curious' ? 10 : 0);
  const rightEarRotation = earTwitch ? 12 : 0;
  const headBob = mood === 'celebrate' ? 'animate-bounce' : '';

  return (
    <div
      onClick={onClick}
      className={`relative inline-flex items-center justify-center select-none cursor-pointer transition-transform duration-200 active:scale-95 ${className}`}
      style={{ width: size, height: size }}
      title="NOVA — Science Companion Bot"
    >
      {/* Scanner Beam Projection */}
      {showScannerBeam && (
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none z-10">
          <div
            className="w-24 h-16 opacity-75"
            style={{
              background: 'linear-gradient(to top, rgba(6, 182, 212, 0.4), transparent)',
              clipPath: 'polygon(35% 100%, 65% 100%, 100% 0%, 0% 0%)',
              filter: 'blur(1px)',
            }}
          />
        </div>
      )}

      {/* SVG Robotic Cat */}
      <svg
        viewBox="0 0 100 100"
        className={`w-full h-full drop-shadow-[0_4px_12px_rgba(6,182,212,0.25)] ${headBob}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Metallic Silver Body Gradient */}
          <linearGradient id="novaChassis" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="60%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          {/* Dark Mechanical Joint Gradient */}
          <linearGradient id="novaJoints" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#475569" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>
          {/* Cyan Glow Filter */}
          <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* --- Robotic Tail --- */}
        <g style={{ transformOrigin: '28px 75px', transform: `rotate(${tailAngle}deg)` }}>
          <path
            d="M 28 75 C 18 70, 8 62, 10 50 C 11 44, 18 42, 20 46"
            stroke="url(#novaChassis)"
            strokeWidth="4"
            strokeLinecap="round"
            fill="none"
          />
          {/* Glowing Tail Tip Sensor */}
          <circle cx="20" cy="46" r="3" fill="#06b6d4" filter="url(#cyanGlow)" />
        </g>

        {/* --- Back Paws & Legs --- */}
        <ellipse cx="32" cy="84" rx="8" ry="5" fill="url(#novaJoints)" />
        <ellipse cx="68" cy="84" rx="8" ry="5" fill="url(#novaJoints)" />

        {/* --- Body Chassis --- */}
        <path
          d="M 34 56 C 34 52, 66 52, 66 56 C 72 65, 70 82, 64 85 C 55 87, 45 87, 36 85 C 30 82, 28 65, 34 56 Z"
          fill="url(#novaChassis)"
          stroke="#94a3b8"
          strokeWidth="1.2"
        />

        {/* Chest Status Light / Power Core */}
        <path
          d="M 47 68 L 50 64 L 53 68 L 50 72 Z"
          fill={mood === 'warning' ? '#f59e0b' : '#06b6d4'}
          filter="url(#cyanGlow)"
        />

        {/* Front Cyber Paws */}
        <rect x="38" y="80" width="7" height="9" rx="3.5" fill="url(#novaChassis)" stroke="#94a3b8" strokeWidth="0.8" />
        <rect x="55" y="80" width="7" height="9" rx="3.5" fill="url(#novaChassis)" stroke="#94a3b8" strokeWidth="0.8" />
        {/* Paw pads micro-light */}
        <circle cx="41.5" cy="86" r="1" fill="#06b6d4" />
        <circle cx="58.5" cy="86" r="1" fill="#06b6d4" />

        {/* --- Cat Ears --- */}
        {/* Left Ear */}
        <g style={{ transformOrigin: '32px 30px', transform: `rotate(${leftEarRotation}deg)` }}>
          <path
            d="M 28 36 L 24 16 C 24 14, 27 14, 30 17 L 42 28 Z"
            fill="url(#novaChassis)"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          {/* Inner cyber ear sensor */}
          <path
            d="M 27 32 L 26 19 L 37 27 Z"
            fill={mood === 'warning' ? '#b45309' : '#0284c7'}
            opacity="0.8"
          />
          <line x1="28" y1="23" x2="33" y2="26" stroke="#38bdf8" strokeWidth="0.8" />
        </g>

        {/* Right Ear */}
        <g style={{ transformOrigin: '68px 30px', transform: `rotate(${rightEarRotation}deg)` }}>
          <path
            d="M 72 36 L 76 16 C 76 14, 73 14, 70 17 L 58 28 Z"
            fill="url(#novaChassis)"
            stroke="#94a3b8"
            strokeWidth="1"
          />
          {/* Inner cyber ear sensor */}
          <path
            d="M 73 32 L 74 19 L 63 27 Z"
            fill={mood === 'warning' ? '#b45309' : '#0284c7'}
            opacity="0.8"
          />
          <line x1="72" y1="23" x2="67" y2="26" stroke="#38bdf8" strokeWidth="0.8" />
        </g>

        {/* --- Head --- */}
        <path
          d="M 28 38 C 28 26, 72 26, 72 38 C 76 46, 75 58, 68 62 C 60 65, 40 65, 32 62 C 25 58, 24 46, 28 38 Z"
          fill="url(#novaChassis)"
          stroke="#94a3b8"
          strokeWidth="1.2"
        />

        {/* Forehead Sensor / Scanner Emitter */}
        <circle cx="50" cy="31" r="2.5" fill="url(#novaJoints)" />
        <circle
          cx="50"
          cy="31"
          r="1.4"
          fill={showScannerBeam ? '#22d3ee' : (mood === 'warning' ? '#f59e0b' : '#06b6d4')}
          filter="url(#cyanGlow)"
        />

        {/* Forehead Tech Seam Line */}
        <path d="M 45 28 L 50 31 L 55 28" stroke="#cbd5e1" strokeWidth="0.8" fill="none" />

        {/* Eyes Component */}
        {renderEyes()}

        {/* Cute Triangular Cyber Nose */}
        <path d="M 48.5 53 L 51.5 53 L 50 55 Z" fill="#64748b" />

        {/* Cat Smile / Mouth */}
        <path
          d="M 46 56 C 47.5 58, 49.5 58, 50 56 C 50.5 58, 52.5 58, 54 56"
          stroke="#64748b"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />

        {/* Cyber Whiskers (Light Thin Antennae) */}
        <g stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" opacity="0.85">
          {/* Left Whiskers */}
          <line x1="33" y1="52" x2="22" y2="50" />
          <line x1="33" y1="55" x2="21" y2="56" />
          {/* Right Whiskers */}
          <line x1="67" y1="52" x2="78" y2="50" />
          <line x1="67" y1="55" x2="79" y2="56" />
        </g>
      </svg>
    </div>
  );
};
