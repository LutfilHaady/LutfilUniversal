export type NodeKind =
  | 'input_material'
  | 'parent_batch'
  | 'focus'
  | 'sibling_sub_batch'
  | 'descendant_batch';

export type RiskLevel = 'high' | 'medium' | 'low' | 'none';

export type BatchStatus =
  | 'InProgress'
  | 'Released'
  | 'OnHold'
  | 'Quarantine'
  | 'Scrapped';

export interface GenealogyNode {
  id: string;
  uuid: string;
  kind: NodeKind;
  material_name: string;
  supplier?: string;
  status: BatchStatus | string;
  risk: RiskLevel;
  reason: string;
  recommended_action?: string;
  tier: number;
}

export interface GenealogyEdge {
  from_uuid: string;
  to_uuid: string;
  highlighted: boolean;
}

export interface GenealogyResponse {
  focus: GenealogyNode;
  ancestors: GenealogyNode[];
  descendants: GenealogyNode[];
  edges: GenealogyEdge[];
}

export interface GenealogyImpactMapProps {
  investigationId: string;
  onTraceNewInvestigation: (newId: string) => void;
  data?: GenealogyResponse;
}

export type ViewMode = 'both' | 'upstream' | 'downstream';
