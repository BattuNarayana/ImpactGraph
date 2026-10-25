
package com.impactgraph.backend.dto.response;

import java.util.List;

public record DependencyGraph(
        List<Node> nodes,
        List<Edge> edges
) {
    public record Node(
            String id,
            String label,
            String filePath
    ) {
    }

    public record Edge(
            String source,
            String target
    ) {
    }
}
