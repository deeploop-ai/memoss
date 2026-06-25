export interface GraphNode {
  data: {
    id: string;
    label: string;
    type: string;
    description: string;
    resource: string;
    tags: string[];
    color: string;
    size: number;
  };
}

export interface GraphEdge {
  data: {
    id: string;
    source: string;
    target: string;
  };
}

export interface GraphBundle {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bodies: Record<string, string>;
  types: string[];
  palette: Record<string, string>;
}

export interface Concept {
  id: string;
  type: string;
  title: string;
  description: string;
  resource: string;
  tags: string[];
  body: string;
  linksTo: string[];
}

export interface GraphGenerationResult {
  concepts: number;
  edges: number;
  bytes: number;
}
