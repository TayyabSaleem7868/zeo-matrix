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
      xmlns="http://www.w3.org/2000/svg"
    >
      <title>{title}</title>
      {/* Background Seal */}
      <path d="M12 2l2.1 2.76 3.4-.6.7 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.7 3.4-3.4-.6L12 22l-2.1-2.76-3.4.6-.7-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.7-3.4 3.4.6L12 2z" className="fill-primary"></path>
      {/* Shadow */}
      <path d="M12 2l2.1 2.76 3.4-.6.7 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.7 3.4-3.4-.6L12 22l-2.1-2.76-3.4.6-.7-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.7-3.4 3.4.6L12 2z" fill="black" opacity="0.18" transform="translate(0 0.6)"></path>
      {/* Highlight Border */}
      <path d="M12 2l2.1 2.76 3.4-.6.7 3.4 3.1 1.6-1.6 3.1 1.6 3.1-3.1 1.6-.7 3.4-3.4-.6L12 22l-2.1-2.76-3.4.6-.7-3.4-3.1-1.6 1.6-3.1-1.6-3.1 3.1-1.6.7-3.4 3.4.6L12 2z" stroke="rgba(255,255,255,0.35)" strokeWidth="1"></path>
      {/* Specific Checkmark Path - Resized to be smaller */}
      <path
        d="M9 12.5L11.5 15L16 10.5"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
