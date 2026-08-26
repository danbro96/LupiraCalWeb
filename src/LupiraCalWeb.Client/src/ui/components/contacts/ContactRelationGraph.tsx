import { useCallback, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import { Background, Controls, Handle, MarkerType, Panel, Position, ReactFlow } from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getListContactRelationsQueryKey, listContactRelations } from '../../../data/api-contact/lupiraContactApi';
import type { ContactRelationEntryDto } from '../../../data/api-contact/models';
import { buildRelationGraph } from '@lupira/cal-domain/contactRelations';
import type { RelationCategory } from '@lupira/cal-domain/contactRelations';
import { useIsPhone } from '../../useIsPhone';

// xyflow reads its own custom props, so category colour needs no descendant selector.
// Written out per category because Tailwind scans for literal class names.
const EDGE_STROKE: Record<RelationCategory, string> = {
  Family: '[--xy-edge-stroke:var(--color-cat-family)]',
  Social: '[--xy-edge-stroke:var(--color-cat-social)]',
  Professional: '[--xy-edge-stroke:var(--color-cat-professional)]',
  Other: '[--xy-edge-stroke:var(--color-cat-other)]',
};
const EDGE_BASE =
  '[--xy-edge-stroke-width:1.5] [--xy-edge-label-color:var(--mui-palette-text-secondary)]';

type RelationNodeData = {
  label: string;
  category: string;
  isCenter: boolean;
  expanded: boolean;
  selected: boolean;
  hit: boolean;
  dimmed: boolean;
  onExpand: (id: string) => void;
  onNavigate: (id: string) => void;
};
type RelationFlowNode = Node<RelationNodeData, 'relation'>;

/** Chip node with centered (hidden) handles so straight edges read as radial spokes. */
function RelationNode({ id, data }: NodeProps<RelationFlowNode>) {
  const state = `${data.isCenter ? ' center' : ''}${data.selected ? ' selected' : ''}${data.hit ? ' hit' : ''}${data.dimmed ? ' dimmed' : ''}`;
  return (
    <div className={`rel-node cat-${data.category}${state}`} title={data.label}>
      <Handle type="target" position={Position.Top} className="top-1/2! min-w-0! min-h-0! opacity-0" isConnectable={false} />
      <Handle type="source" position={Position.Top} className="top-1/2! min-w-0! min-h-0! opacity-0" isConnectable={false} />
      <span className="rel-node-label">{data.label}</span>
      {data.selected && !data.isCenter && (
        <button
          className="rel-expand"
          title="Open contact"
          onClick={(e) => {
            e.stopPropagation();
            data.onNavigate(id);
          }}
        >
          ↗
        </button>
      )}
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

/** Interactive ego-graph: center contact + expand-on-click neighbours, one query per fetched node.
 *  Inferred kin (grandparents, cousins, …) are fetched for the center only and drawn as dashed spokes.
 *  Click selects (syncs with the list); ↗ on the selected pill or double-click opens the contact. */
export function ContactRelationGraph({
  centerId,
  centerLabel,
  includeInferred,
  categories,
  query,
  selectedId,
  onSelect,
}: {
  centerId: string;
  centerLabel: string;
  includeInferred: boolean;
  categories: ReadonlySet<RelationCategory>;
  query: string;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const isPhone = useIsPhone();
  const [expandedIds, setExpandedIds] = useState<string[]>([centerId]);
  const [fullscreen, setFullscreen] = useState(false);
  const expand = useCallback(
    (id: string) => setExpandedIds((ids) => (ids.includes(id) ? ids : [...ids, id])),
    [],
  );
  const open = useCallback(
    (id: string) => navigate({ pathname: `/contacts/${id}`, search: location.search }),
    [navigate, location.search],
  );

  const results = useQueries({
    queries: expandedIds.map((id) => {
      const params = id === centerId && includeInferred ? { includeInferred: true } : undefined;
      return { queryKey: getListContactRelationsQueryKey(id, params), queryFn: () => listContactRelations(id, params) };
    }),
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
    () => buildRelationGraph({ id: centerId, label: centerLabel }, entriesByContact, { categories }),
    [centerId, centerLabel, entriesByContact, categories],
  );

  const q = query.trim().toLowerCase();
  const expandedSet = useMemo(() => new Set(expandedIds), [expandedIds]);
  const rfNodes: RelationFlowNode[] = graph.nodes.map((n) => {
    const hit = q.length > 0 && n.label.toLowerCase().includes(q);
    return {
      id: n.id,
      type: 'relation',
      position: { x: n.x, y: n.y },
      data: {
        label: n.label,
        category: n.category,
        isCenter: n.isCenter,
        expanded: expandedSet.has(n.id),
        selected: n.id === selectedId,
        hit,
        dimmed: q.length > 0 && !hit,
        onExpand: expand,
        onNavigate: open,
      },
    };
  });
  const rfEdges: Edge[] = graph.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label ?? e.kind,
    type: 'straight',
    className: `${EDGE_BASE} ${EDGE_STROKE[e.category] ?? EDGE_STROKE.Other}${
      e.inferred ? ' opacity-75 [stroke-dasharray:5_4]' : ''
    }`,
    markerEnd: e.directed ? { type: MarkerType.ArrowClosed } : undefined,
  }));

  if (results[0]?.isLoading) return <p className="meta">Loading relations…</p>;
  if (graph.edges.length === 0)
    return <p className="empty">{categories.size > 0 ? 'No relations in the selected categories.' : 'No relations yet.'}</p>;

  const flow = (
    <ReactFlow
      key={[...categories].sort().join(',')} // reshaped layout on filter change → refit the view
      nodes={rfNodes}
      edges={rfEdges}
      nodeTypes={nodeTypes}
      colorMode="system"
      fitView
      fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
      minZoom={0.2}
      onlyRenderVisibleElements
      nodesConnectable={false}
      onNodeClick={(_, node) => onSelect(node.id === selectedId ? null : node.id)}
      onNodeDoubleClick={(_, node) => {
        if (node.id !== centerId) open(node.id);
      }}
      onPaneClick={() => onSelect(null)}
    >
      <Background />
      <Controls showInteractive={false} />
      <Panel position="top-right">
        <Tooltip title={fullscreen ? 'Close' : 'Fullscreen'}>
          <IconButton onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? <CloseFullscreenIcon fontSize="small" /> : <OpenInFullIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Panel>
    </ReactFlow>
  );

  if (fullscreen)
    return (
      <Dialog open onClose={() => setFullscreen(false)} fullScreen>
        <div className="relation-graph fullscreen">{flow}</div>
      </Dialog>
    );
  // The inline embed is unusable at phone width — offer the fullscreen modal instead.
  if (isPhone)
    return (
      <Button variant="outlined" startIcon={<OpenInFullIcon />} onClick={() => setFullscreen(true)}>
        Open relation graph
      </Button>
    );
  return <div className="relation-graph">{flow}</div>;
}
