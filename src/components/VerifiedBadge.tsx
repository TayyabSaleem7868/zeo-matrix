import React from "react";

type VerifiedBadgeProps = {
  className?: string;
  /** Default 16 to match common inline icon sizes */
  size?: number;
  title?: string;
};

/**
 * Clean verified badge that looks good at small sizes.
 * Uses inline SVG to avoid depending on a specific icon pack shape.
 */
export const VerifiedBadge: React.FC<VerifiedBadgeProps> = ({
  className,
  size = 16,
  title = "Verified",
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>

      {/* subtle lift */}
      <path
        d="M12 2l2.1 2.76 3.4-.6.7 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.7 3.4-3.4-.6L12 22l-2.1-2.76-3.4.6-.7-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.7-3.4 3.4.6L12 2z"
        fill="black"
        opacity="0.18"
        transform="translate(0 0.6)"
      />

      {/* premium solid badge */}
      <path
        d="M12 2l2.1 2.76 3.4-.6.7 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.7 3.4-3.4-.6L12 22l-2.1-2.76-3.4.6-.7-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.7-3.4 3.4.6L12 2z"
        className="fill-current"
      />

      {/* thin highlight ring */}
      <path
        d="M12 2l2.1 2.76 3.4-.6.7 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.7 3.4-3.4-.6L12 22l-2.1-2.76-3.4.6-.7-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.7-3.4 3.4.6L12 2z"
        stroke="rgba(255,255,255,0.35)"
        strokeWidth="1"
      />

      {/* white check */}
      <path
        d="M8.15 12.35l2.35 2.35L15.9 9.3"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
