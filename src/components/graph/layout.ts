import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/react'

const NODE_WIDTH = 260
const NODE_HEIGHT = 76

// Los edges van de commit -> padre. Con rankdir TB, dagre coloca el origen
// del edge por encima del destino, así que el hijo (más reciente) queda arriba.
export function layoutCommitGraph(nodes: Node[], edges: Edge[]): Node[] {
  const graph = new dagre.graphlib.Graph()
  graph.setGraph({ rankdir: 'TB', nodesep: 32, ranksep: 70 })
  graph.setDefaultEdgeLabel(() => ({}))

  nodes.forEach((node) => graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach((edge) => graph.setEdge(edge.source, edge.target))

  dagre.layout(graph)

  return nodes.map((node) => {
    const { x, y } = graph.node(node.id)
    return { ...node, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } }
  })
}
