import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow } from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getListContactRelationsQueryKey, listContactRelations } from '../../../data/api/lupiraCalApi';
import type { ContactRelationEntryDto } from '../../../data/api/models';
import { buildRelationGraph } from '../../../domain/contactRelations';

type RelationNodeData = {
  label: string;
  category: string;
  isCenter: boolean;
  expanded: boolean;
  onExpand: (id: string) => void;
};
type RelationFlowNode = Node<RelationNodeData, 'relation'>;

/** Chip node with centered (hidden) handles so straight edges read as radial spokes. */
function RelationNode({ id, data }: NodeProps<RelationFlowNode>) {
  return (
    <div className={`rel-node cat-${data.category}${data.isCenter ? ' center' : ''}`}>
      <Handle type="target" position={Position.Top} className="rel-handle" isConnectable={false} />
      <Handle type="source" position={Position.Top} className="rel-handle" isConnectable={false} />
      <span className="rel-node-label">{data.label}</span>
      {!data.isCenter && !data.expanded && (
        <button
          className="rel-expand"
          title="Expand relations"
          onClick={(e) => {
            e.stopPropagation();
            data.onExpand(id);
          }}
        >
          ＋
        </button>
      )}
    </div>
  );
}

const nodeTypes = { relation: RelationNode };

/** Interactive ego-graph: center contact + expand-on-click neighbours, one query per fetched node. */
export function ContactRelationGraph({ centerId, centerLabel }: { centerId: string; centerLabel: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedIds, setExpandedIds] = useState<string[]>([centerId]);
  const expand = useCallback(
    (id: string) => setExpandedIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    [],
  );

  const results = useQueries({
    queries: expandedIds.map((id) => ({
      queryKey: getListContactRelationsQueryKey(id),
      queryFn: () => listContactRelations(id),
    })),
  });

  const entriesByContact = useMemo(() => {
    const m = new Map<string, ContactRelationEntryDto[]>();
    expandedIds.forEach((id, i) => {
      const data = results[i]?.data;
      if (data) m.set(id, data);
    });
    return m;
  }, [expandedIds, results]);

  const graph = useMemo(
    () => buildRelationGraph({ id: centerId, label: centerLabel }, entriesByContact),
    [centerId, centerLabel, entriesByContact],
  );

  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const rfNodes: RelationFlowNode[] = graph.nodes.map((n) => ({
    id: n.id,
    type: 'relation',
    position: { x: n.x, y: n.y },
    data: { label: n.label, category: n.category, isCenter: n.isCenter, expanded: expandedSet.has(n.id), onExpand: expand },
  }));
  const rfEdges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? e.kind,
    type: 'straight',
    className: `rel-edge cat-${e.category}`,
    markerEnd: e.directed ? { type: MarkerType.ArrowClosed } : undefined,
  }));

  if (results[0]?.isLoading) return <p className="meta">Loading relations…</p>;
  if (graph.edges.length === 0) return <p className="empty">No relations yet.</p>;

  return (
    <div className="relation-graph">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        colorMode="system"
        fitView
        fitViewOptions={{ padding: 0.25 }}
        nodesConnectable={false}
        onNodeClick={(_, node) => {
          if (node.id !== centerId) navigate({ pathname: `/contacts/${node.id}`, search: location.search });
        }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
