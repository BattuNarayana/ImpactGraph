package com.impactgraph.backend.service;

import com.impactgraph.backend.dto.response.DependencyGraph;
import com.impactgraph.backend.entity.DependencyEdge;
import com.impactgraph.backend.entity.DependencyNode;
import com.impactgraph.backend.repository.DependencyEdgeRepository;
import com.impactgraph.backend.repository.DependencyNodeRepository;
import com.impactgraph.backend.scanner.JavaSourceScanner;
import com.impactgraph.backend.scanner.JavaSourceScanner.ClassInfo;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.Queue;
import java.util.Set;
import java.util.HashSet;
import java.util.LinkedList;

@Service
public class DependencyGraphService {

    private final DependencyNodeRepository nodeRepository;
    private final DependencyEdgeRepository edgeRepository;
    private final JavaSourceScanner scanner;

    public DependencyGraphService(
            DependencyNodeRepository nodeRepository,
            DependencyEdgeRepository edgeRepository,
            JavaSourceScanner scanner) {
        this.nodeRepository = nodeRepository;
        this.edgeRepository = edgeRepository;
        this.scanner = scanner;
    }

    @Transactional
    public DependencyGraph scanAndSave(Long projectId, String projectPath)
            throws java.io.IOException {

        List<ClassInfo> classes = scanner.scanProject(projectPath);

        // Remove the old graph for this project before saving the new one
        List<DependencyEdge> oldEdges =
                edgeRepository.findByProjectId(projectId);
        edgeRepository.deleteAll(oldEdges);

        List<DependencyNode> oldNodes =
                nodeRepository.findByProjectId(projectId);
        nodeRepository.deleteAll(oldNodes);

        Map<String, String> classLookup = classes.stream()
                .collect(Collectors.toMap(
                        c -> c.className().substring(
                                c.className().lastIndexOf('.') + 1),
                        ClassInfo::className,
                        (first, second) -> first
                ));

        List<DependencyNode> nodes = classes.stream()
                .map(c -> new DependencyNode(
                        projectId,
                        c.className(),
                        c.filePath()))
                .toList();

        nodeRepository.saveAll(nodes);

        List<DependencyEdge> edges = new ArrayList<>();

        for (ClassInfo c : classes) {
            for (String dependency : c.dependencies()) {
                String target = classLookup.get(dependency);

                if (target != null) {
                    edges.add(new DependencyEdge(
                            projectId,
                            c.className(),
                            target));
                }
            }
        }

        edgeRepository.saveAll(edges);

        List<DependencyGraph.Node> graphNodes = classes.stream()
                .map(c -> new DependencyGraph.Node(
                        c.className(),
                        c.className().substring(
                                c.className().lastIndexOf('.') + 1),
                        c.filePath()))
                .toList();

        List<DependencyGraph.Edge> graphEdges = edges.stream()
                .map(e -> new DependencyGraph.Edge(
                        e.getSourceClass(),
                        e.getTargetClass()))
                .toList();

        return new DependencyGraph(graphNodes, graphEdges);
    }
    public DependencyGraph getSavedGraph(Long projectId) {

        List<DependencyNode> nodes =
                nodeRepository.findByProjectId(projectId);

        List<DependencyEdge> edges =
                edgeRepository.findByProjectId(projectId);

        List<DependencyGraph.Node> graphNodes = nodes.stream()
                .map(node -> new DependencyGraph.Node(
                        node.getClassName(),
                        node.getClassName().substring(
                                node.getClassName().lastIndexOf('.') + 1),
                        node.getFilePath()
                ))
                .toList();

        List<DependencyGraph.Edge> graphEdges = edges.stream()
                .map(edge -> new DependencyGraph.Edge(
                        edge.getSourceClass(),
                        edge.getTargetClass()
                ))
                .toList();

        return new DependencyGraph(graphNodes, graphEdges);
    }
    public List<String> findImpactedClasses(
            Long projectId,
            String changedClass) {

        List<DependencyEdge> edges =
                edgeRepository.findByProjectId(projectId);

        // Reverse dependency lookup:
        // if A depends on B, changing B may impact A.
        Map<String, List<String>> dependents = edges.stream()
                .collect(Collectors.groupingBy(
                        DependencyEdge::getTargetClass,
                        Collectors.mapping(
                                DependencyEdge::getSourceClass,
                                Collectors.toList()
                        )
                ));

        List<String> impacted = new ArrayList<>();
        java.util.Set<String> visited = new java.util.HashSet<>();
        java.util.Queue<String> queue = new java.util.LinkedList<>();

        visited.add(changedClass);
        queue.add(changedClass);

        while (!queue.isEmpty()) {
            String current = queue.poll();

            for (String dependent :
                    dependents.getOrDefault(current, List.of())) {

                if (visited.add(dependent)) {
                    impacted.add(dependent);
                    queue.add(dependent);
                }
            }
        }

        return impacted;
    }
    public Map<String, Object> getGraphSummary(Long projectId) {

        List<DependencyNode> nodes =
                nodeRepository.findByProjectId(projectId);

        List<DependencyEdge> edges =
                edgeRepository.findByProjectId(projectId);

        Map<String, Long> dependencyCounts = edges.stream()
                .collect(Collectors.groupingBy(
                        DependencyEdge::getSourceClass,
                        Collectors.counting()
                ));

        Map<String, Object> summary = new java.util.LinkedHashMap<>();
        summary.put("totalClasses", nodes.size());
        summary.put("totalDependencies", edges.size());
        summary.put("mostDependentClasses",
                dependencyCounts.entrySet().stream()
                        .sorted(Map.Entry.<String, Long>comparingByValue()
                                .reversed())
                        .limit(5)
                        .toList());

        return summary;
    }
}