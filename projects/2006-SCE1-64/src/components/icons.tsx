import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 40"
      width="120"
      height="24"
      {...props}
    >
      <text
        x="0"
        y="30"
        fontFamily="var(--font-headline), sans-serif"
        fontSize="32"
        fontWeight="bold"
        fill="hsl(var(--primary))"
        className="font-headline"
      >
        JobView
      </text>
    </svg>
  );
}
