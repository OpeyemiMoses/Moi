import React from 'react';

export function MoiRibbonMark({
  className = 'w-10 h-8',
}: {
  className?: string;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 160 120"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id="moiMintLeft"
          x1="12"
          y1="104"
          x2="62"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00E676" />
          <stop offset="65%" stopColor="#087F5B" />
          <stop offset="100%" stopColor="#0B0F14" />
        </linearGradient>
        <linearGradient
          id="moiFoldLeft"
          x1="38"
          y1="16"
          x2="84"
          y2="96"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0B0F14" />
          <stop offset="55%" stopColor="#0D281E" />
          <stop offset="100%" stopColor="#087F5B" />
        </linearGradient>
        <linearGradient
          id="moiMintCenter"
          x1="68"
          y1="98"
          x2="118"
          y2="16"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#00C853" />
          <stop offset="50%" stopColor="#00E676" />
          <stop offset="100%" stopColor="#5EFC82" />
        </linearGradient>
        <linearGradient
          id="moiFoldRight"
          x1="104"
          y1="18"
          x2="146"
          y2="104"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="#0B0F14" />
          <stop offset="50%" stopColor="#087F5B" />
          <stop offset="100%" stopColor="#00E676" />
        </linearGradient>
      </defs>
      <path
        d="M36 22C42 12 56 12 62 22L92 78C96 86 90 96 80 96H68C61 96 55 92 52 86L28 40L36 22Z"
        fill="url(#moiFoldLeft)"
      />
      <path
        d="M98 22C104 12 118 12 124 22L148 76C153 87 145 100 133 100H122C114 100 107 95 104 87L88 50L98 22Z"
        fill="url(#moiFoldRight)"
      />
      <path
        d="M12 76L36 22C42 11 57 11 63 22L50 52L38 86C34 96 24 100 16 96C8 92 7 84 12 76Z"
        fill="url(#moiMintLeft)"
      />
      <path
        d="M62 78L96 20C102 10 117 10 123 20C127 27 126 36 121 44L88 92C81 101 67 100 61 90C58 86 59 82 62 78Z"
        fill="url(#moiMintCenter)"
      />
    </svg>
  );
}

/**
 * Large, True-3D Extruded "M" Ribbon Emblem with Actively Moving 3D Spiral Orbits
 * Matches and elevates the Hero Artwork in the MOI UI Kit.
 */
export function MoiHero3DEmblem() {
  return (
    <div className="moi-3d-scene relative flex items-center justify-center w-full h-[440px] sm:h-[500px] lg:h-[560px] select-none">
      {/* Multi-layered Soft Mint & Emerald Volumetric Aura */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-3xl opacity-85"
        style={{
          background:
            'radial-gradient(circle at 52% 48%, rgba(0,230,118,0.32) 0%, rgba(182,247,210,0.85) 38%, rgba(8,127,91,0.12) 66%, rgba(248,250,252,0) 80%)',
        }}
      />

      {/* 3D Floor Ambient Contact Shadow */}
      <div
        className="moi-shadow-pulse pointer-events-none absolute bottom-2 w-80 sm:w-96 h-12 rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(11,15,20,0.55) 0%, rgba(8,127,91,0.25) 55%, rgba(0,0,0,0) 80%)',
        }}
      />

      <svg
        viewBox="0 0 520 460"
        className="relative z-10 w-full max-w-[560px] sm:max-w-[620px] h-auto overflow-visible"
        fill="none"
      >
        <defs>
          {/* Deep 3D Extrusion Sidewall Gradient */}
          <linearGradient
            id="moi3dExtrudeSide"
            x1="0"
            y1="0"
            x2="160"
            y2="120"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#050807" />
            <stop offset="50%" stopColor="#091D16" />
            <stop offset="100%" stopColor="#064E38" />
          </linearGradient>

          {/* Left Upstroke Volumetric Mint-to-Emerald Gradient */}
          <linearGradient
            id="moi3dMintLeft"
            x1="10"
            y1="108"
            x2="64"
            y2="12"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00E676" />
            <stop offset="45%" stopColor="#00C853" />
            <stop offset="82%" stopColor="#087F5B" />
            <stop offset="100%" stopColor="#0B1914" />
          </linearGradient>

          {/* Center-Left Deep Midnight Fold Gradient */}
          <linearGradient
            id="moi3dFoldLeft"
            x1="36"
            y1="14"
            x2="88"
            y2="98"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0B0F14" />
            <stop offset="48%" stopColor="#0E291F" />
            <stop offset="85%" stopColor="#087F5B" />
            <stop offset="100%" stopColor="#00C853" />
          </linearGradient>

          {/* Center Diagonal Specular Mint Ribbon */}
          <linearGradient
            id="moi3dMintCenter"
            x1="60"
            y1="102"
            x2="124"
            y2="12"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#087F5B" />
            <stop offset="28%" stopColor="#00C853" />
            <stop offset="68%" stopColor="#00E676" />
            <stop offset="100%" stopColor="#9CFFCE" />
          </linearGradient>

          {/* Right Downstroke Fold */}
          <linearGradient
            id="moi3dFoldRight"
            x1="100"
            y1="14"
            x2="150"
            y2="104"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0B0F14" />
            <stop offset="42%" stopColor="#0B3B2B" />
            <stop offset="78%" stopColor="#087F5B" />
            <stop offset="100%" stopColor="#00E676" />
          </linearGradient>

          {/* Specular Top-Edge Rim Light */}
          <linearGradient
            id="moi3dRimLight"
            x1="0"
            y1="0"
            x2="160"
            y2="100"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
            <stop offset="50%" stopColor="#B6F7D2" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#00E676" stopOpacity="0.0" />
          </linearGradient>

          {/* Animated Spiral Gradient */}
          <linearGradient
            id="moiSpiralStroke"
            x1="40"
            y1="320"
            x2="480"
            y2="110"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#00E676" stopOpacity="0.95" />
            <stop offset="50%" stopColor="#087F5B" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#00E676" stopOpacity="0.9" />
          </linearGradient>

          {/* Heavy 3D Drop Shadow Filter */}
          <filter
            id="moi3dShadow"
            x="-25%"
            y="-25%"
            width="150%"
            height="160%"
          >
            <feDropShadow
              dx="0"
              dy="22"
              stdDeviation="16"
              floodColor="#071F16"
              floodOpacity="0.42"
            />
            <feDropShadow
              dx="-8"
              dy="10"
              stdDeviation="6"
              floodColor="#0B0F14"
              floodOpacity="0.35"
            />
          </filter>

          {/* Neon Mint Node Glow */}
          <filter id="moiNodeGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* =================================================================
            BACK-LAYER MOVING 3D SPIRALS (Revolving Behind the 3D M)
           ================================================================= */}
        <g transform="rotate(-24 260 230)">
          {/* Outer Continuous Orbit Track */}
          <ellipse
            cx="260"
            cy="230"
            rx="235"
            ry="96"
            stroke="url(#moiSpiralStroke)"
            strokeWidth="1.75"
            strokeOpacity="0.55"
          />
          {/* Animated Streaming Energy Spiral 1 */}
          <ellipse
            cx="260"
            cy="230"
            rx="235"
            ry="96"
            stroke="#00E676"
            strokeWidth="2.75"
            strokeLinecap="round"
            className="moi-spiral-dash-flow"
          />
        </g>

        <g transform="rotate(19 260 230)">
          <ellipse
            cx="260"
            cy="230"
            rx="198"
            ry="76"
            stroke="#087F5B"
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          <ellipse
            cx="260"
            cy="230"
            rx="198"
            ry="76"
            stroke="#00E676"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="moi-spiral-dash-flow-fast"
          />
        </g>

        {/* Revolving 3D Satellite Ring (Clockwise) */}
        <g className="moi-spiral-orbit-cw">
          <circle
            cx="260"
            cy="230"
            r="178"
            stroke="#00E676"
            strokeOpacity="0.18"
            strokeWidth="1.2"
            strokeDasharray="8 16"
          />
          <g filter="url(#moiNodeGlow)">
            <circle cx="82" cy="230" r="6.5" fill="#00E676" />
            <circle cx="82" cy="230" r="13" fill="#00E676" fillOpacity="0.28" />
            <circle cx="438" cy="230" r="5" fill="#087F5B" />
          </g>
        </g>

        {/* =================================================================
            CENTERPIECE: LARGE TRUE-3D EXTRUDED "M" RIBBON
            Scaled 2.35x with Deep Extrusion Layers + Specular Bevels
           ================================================================= */}
        <g className="moi-3d-emblem-float" filter="url(#moi3dShadow)">
          {/* Layer 0: Deep 3D Extrusion Back-Plate (gives true volumetric thickness) */}
          <g transform="translate(82, 92) scale(2.28)">
            <path
              d="M36 22C42 12 56 12 62 22L92 78C96 86 90 96 80 96H68C61 96 55 92 52 86L28 40L36 22Z"
              fill="url(#moi3dExtrudeSide)"
            />
            <path
              d="M98 22C104 12 118 12 124 22L148 76C153 87 145 100 133 100H122C114 100 107 95 104 87L88 50L98 22Z"
              fill="url(#moi3dExtrudeSide)"
            />
            <path
              d="M12 76L36 22C42 11 57 11 63 22L50 52L38 86C34 96 24 100 16 96C8 92 7 84 12 76Z"
              fill="url(#moi3dExtrudeSide)"
            />
            <path
              d="M62 78L96 20C102 10 117 10 123 20C127 27 126 36 121 44L88 92C81 101 67 100 61 90C58 86 59 82 62 78Z"
              fill="url(#moi3dExtrudeSide)"
            />
          </g>

          {/* Layer 1: Mid-Depth 3D Bevel Step */}
          <g transform="translate(77, 86) scale(2.28)">
            <path
              d="M36 22C42 12 56 12 62 22L92 78C96 86 90 96 80 96H68C61 96 55 92 52 86L28 40L36 22Z"
              fill="#07251B"
            />
            <path
              d="M98 22C104 12 118 12 124 22L148 76C153 87 145 100 133 100H122C114 100 107 95 104 87L88 50L98 22Z"
              fill="#07251B"
            />
            <path
              d="M12 76L36 22C42 11 57 11 63 22L50 52L38 86C34 96 24 100 16 96C8 92 7 84 12 76Z"
              fill="#087F5B"
            />
            <path
              d="M62 78L96 20C102 10 117 10 123 20C127 27 126 36 121 44L88 92C81 101 67 100 61 90C58 86 59 82 62 78Z"
              fill="#087F5B"
            />
          </g>

          {/* Layer 2: Front Sculpted 3D Ribbon Surfaces + Specular Highlights */}
          <g transform="translate(72, 80) scale(2.28)">
            {/* Inner Dark Fold Left */}
            <path
              d="M36 22C42 12 56 12 62 22L92 78C96 86 90 96 80 96H68C61 96 55 92 52 86L28 40L36 22Z"
              fill="url(#moi3dFoldLeft)"
            />
            {/* Inner Dark Fold Right */}
            <path
              d="M98 22C104 12 118 12 124 22L148 76C153 87 145 100 133 100H122C114 100 107 95 104 87L88 50L98 22Z"
              fill="url(#moi3dFoldRight)"
            />
            {/* Ambient Occlusion Crease Shadows under the overlapping mint ribbons */}
            <path
              d="M36 22C42 12 56 12 62 22L53 46L33 28L36 22Z"
              fill="#000000"
              fillOpacity="0.38"
            />
            <path
              d="M98 22C104 12 118 12 124 22L116 44L93 30L98 22Z"
              fill="#000000"
              fillOpacity="0.35"
            />
            {/* Front Left Mint Upstroke */}
            <path
              d="M12 76L36 22C42 11 57 11 63 22L50 52L38 86C34 96 24 100 16 96C8 92 7 84 12 76Z"
              fill="url(#moi3dMintLeft)"
              stroke="url(#moi3dRimLight)"
              strokeWidth="0.9"
            />
            {/* Front Center Specular Mint Diagonal Ribbon */}
            <path
              d="M62 78L96 20C102 10 117 10 123 20C127 27 126 36 121 44L88 92C81 101 67 100 61 90C58 86 59 82 62 78Z"
              fill="url(#moi3dMintCenter)"
              stroke="url(#moi3dRimLight)"
              strokeWidth="1.1"
            />
            {/* Glossy Specular Highlight Streak along the 3D Ridge */}
            <path
              d="M68 76L99 24C104 16 114 16 118 22"
              stroke="#FFFFFF"
              strokeOpacity="0.55"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <path
              d="M18 74L39 26C43 18 52 17 57 22"
              stroke="#FFFFFF"
              strokeOpacity="0.4"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>
        </g>

        {/* =================================================================
            FOREGROUND MOVING 3D SPIRAL ARCS & ORBITAL NODES
            Passes IN FRONT OF the 3D M to create true 3D wrap-around depth!
           ================================================================= */}
        <g transform="rotate(-24 260 230)">
          {/* Foreground lower arc of the primary 3D ellipse */}
          <path
            d="M 25 230 A 235 96 0 0 0 495 230"
            stroke="#00E676"
            strokeWidth="3.2"
            strokeOpacity="0.85"
            strokeLinecap="round"
            className="moi-spiral-dash-flow"
          />
        </g>

        {/* Counter-Clockwise Revolving 3D Orbital Nodes */}
        <g className="moi-spiral-orbit-ccw" filter="url(#moiNodeGlow)">
          <circle cx="260" cy="36" r="6" fill="#00E676" />
          <circle cx="260" cy="36" r="14" fill="#00E676" fillOpacity="0.24" />
          <circle cx="260" cy="424" r="4.5" fill="#00C853" />
          <circle cx="94" cy="130" r="4" fill="#087F5B" />
          <circle cx="426" cy="330" r="5.5" fill="#00E676" />
        </g>
      </svg>
    </div>
  );
}
