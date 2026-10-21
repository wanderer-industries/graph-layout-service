export type Direction = 'TB' | 'BT' | 'LR' | 'RL';
export type Routing = 'straight' | 'polyline' | 'orthogonal' | 'spline';
export type LayoutEngineName = 'elk' | 'dagre';
export type OrderBy = 'name' | 'id' | 'previous-order';
export type OrderDirection = 'asc' | 'desc';
export type OrderPolicy = 'strict' | 'prefer' | 'crossings-first';
export type GroupMode = 'none' | 'compound';

export interface Point {
  x: number;
  y: number;
}

export interface LayoutNode {
  id: string;
  name: string;
  width: number;
  height: number;
  groupId?: string;
  rank?: number;
  previousPosition?: Point;
  pinned?: boolean;
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  weight?: number;
  minRankSpan?: number;
}

export interface LayoutOptions {
  engine?: LayoutEngineName;
  direction: Direction;
  routing: Routing;
  includeEdgeRoutes?: boolean;
  spacing: {
    nodeSpacing: number;
    layerSpacing: number;
    edgeSpacing: number;
  };
  ordering: {
    by: OrderBy;
    direction: OrderDirection;
    locale: string;
    policy: OrderPolicy;
  };
  groups: GroupMode;
  stability?: {
    preservePreviousPositions?: boolean;
  };
}

export interface LayoutRequest {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  options: LayoutOptions;
}

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoutedEdge {
  id: string;
  points: Point[];
}

export interface LayoutResult {
  nodes: PositionedNode[];
  edges?: RoutedEdge[];
  bounds: { x: number; y: number; width: number; height: number };
  engine: { name: LayoutEngineName; version: string };
  durationMs: number;
  warnings: string[];
}

export interface LayoutEngine {
  readonly name: LayoutEngineName;
  readonly version: string;
  layout(request: LayoutRequest): Promise<LayoutResult>;
}
