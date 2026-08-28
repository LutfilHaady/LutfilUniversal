interface Props {
  path: string;
  highlighted: boolean;
  opacity: number;
  markerId: string;
}

export default function GenealogyEdge({ path, highlighted, opacity, markerId }: Props) {
  return (
    <path
      d={path}
      fill="none"
      stroke={highlighted ? '#993C1D' : '#888780'}
      strokeWidth={highlighted ? 2 : 1.5}
      markerEnd={`url(#${markerId})`}
      style={{ opacity, transition: 'opacity 0.2s ease' }}
    />
  );
}
