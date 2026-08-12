import { useMemo } from 'react'
import { Background, Controls, MiniMap, ReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import type { Commit } from '../../../shared/ipc-contract'
import { CommitNode, type CommitNodeData } from './CommitNode'
import { layoutCommitGraph } from './layout'

const nodeTypes = { commit: CommitNode }

interface CommitGraphProps {
  commits: Commit[]
  // Nombres de rama a resaltar en el grafo (p.ej. las dos ramas de un merge/rebase pendiente).
  highlightRefs?: string[]
}

export function CommitGraph({ commits, highlightRefs = [] }: CommitGraphProps) {
  const { nodes, edges } = useMemo(() => {
    const commitIds = new Set(commits.map((c) => c.hash))

    const rawNodes: Node[] = commits.map((commit) => ({
      id: commit.hash,
      type: 'commit',
      position: { x: 0, y: 0 },
      data: {
        shortHash: commit.shortHash,
        message: commit.message,
        author: commit.author,
        date: commit.date,
        refs: commit.refs,
        highlighted: commit.refs.some((ref) => highlightRefs.includes(ref)),
      } satisfies CommitNodeData,
    }))

    const rawEdges: Edge[] = commits.flatMap((commit) =>
      commit.parents
        .filter((parentHash) => commitIds.has(parentHash))
        .map((parentHash, index) => ({
          id: `${commit.hash}-${parentHash}`,
          source: commit.hash,
          target: parentHash,
          // El primer padre continúa la rama; el resto son uniones de merge.
          style: { stroke: index === 0 ? '#10b981' : '#f59e0b', strokeWidth: 2 },
        }))
    )

    return { nodes: layoutCommitGraph(rawNodes, rawEdges), edges: rawEdges }
  }, [commits, highlightRefs])

  if (commits.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-slate-400">
        Sin commits que mostrar.
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      colorMode="dark"
    >
      <Background color="#334155" gap={20} />
      <Controls />
      <MiniMap pannable zoomable className="!bg-slate-900" />
    </ReactFlow>
  )
}
