import type { SVGProps } from "react";

export function PesoSignIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8 19h8" />
      <path d="M8 15h8" />
      <path d="M12 4v16" />
      <path d="M15.5 9.5a4.5 4.5 0 0 0-8-2.5" />
      <path d="M6 14.5a4.5 4.5 0 1 0 8-2.5" />
    </svg>
  );
}
