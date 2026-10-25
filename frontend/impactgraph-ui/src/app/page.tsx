"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Panel,
  Position,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";

const API_BASE = "http://localhost:8080/api/projects";

// ==========================================
// TYPES & DATA MODELS
// ==========================================

type GraphNode = {
  id: string;
  label: string;
  filePath: string;
};

type GraphData = {
  nodes: GraphNode[];
  edges: { source: string; target: string }[];
};

type GraphNodeData = {
  label: string;
  filePath: string;
  isSelected?: boolean;
  isImpacted?: boolean;
  degree?: number;
  [key: string]: unknown;
};

type ImpactGraphNode = Node<GraphNodeData>;

// ==========================================
// DAGRE AUTOMATIC LAYOUT HELPER
// ==========================================

function layoutGraph(
  graphNodes: ImpactGraphNode[],
  graphEdges: Edge[]
): ImpactGraphNode[] {
  const graph = new dagre.graphlib.Graph();

  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "LR",
    nodesep: 50,
    ranksep: 100,
    marginx: 30,
    marginy: 30,
  });

  graphNodes.forEach((node) => {
    graph.setNode(node.id, { width: 250, height: 100 });
  });

  graphEdges.forEach((edge) => {
    graph.setEdge(edge.source, edge.target);
  });

  dagre.layout(graph);

  return graphNodes.map((node) => {
    const position = graph.node(node.id);

    return {
      ...node,
      position: {
        x: position.x - 125,
        y: position.y - 50,
      },
    };
  });
}

type DependentClass = {
  className: string;
  count: number;
};

type Summary = {
  totalClasses: number;
  totalDependencies: number;
  mostDependentClasses: DependentClass[];
};

const initialSummary: Summary = {
  totalClasses: 0,
  totalDependencies: 0,
  mostDependentClasses: [],
};

// ==========================================
// NORMALIZATION HELPERS
// ==========================================

function normalizeMostDependent(data: unknown): DependentClass[] {
  if (Array.isArray(data)) {
    return data
      .map((item): DependentClass | null => {
        if (typeof item === "object" && item !== null) {
          const record = item as Record<string, unknown>;
          const entries = Object.entries(record);

          if (
            typeof record.className === "string" &&
            Number.isFinite(Number(record.count ?? record.dependencyCount))
          ) {
            return {
              className: record.className,
              count: Number(record.count ?? record.dependencyCount),
            };
          }

          const entry = entries.find(
            ([key, value]) =>
              key !== "className" &&
              key !== "count" &&
              key !== "dependencyCount" &&
              typeof value === "number" &&
              Number.isFinite(value)
          );

          if (entry) {
            return { className: entry[0], count: entry[1] as number };
          }
        }

        return null;
      })
      .filter((item): item is DependentClass => item !== null)
      .sort((a, b) => b.count - a.count);
  }

  if (typeof data === "object" && data !== null) {
    return Object.entries(data as Record<string, unknown>)
      .filter((entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1])
      )
      .map(([className, count]) => ({ className, count }))
      .sort((a, b) => b.count - a.count);
  }

  return [];
}

function normalizeImpacted(data: unknown): string[] {
  let items: unknown[] = [];

  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === "object" && data !== null) {
    const record = data as Record<string, unknown>;
    const candidate =
      record.impactedClasses ?? record.impacted ?? record.affectedClasses;

    if (Array.isArray(candidate)) {
      items = candidate;
    }
  }

  return items
    .map((item) => {
      if (typeof item === "string") return item;

      if (typeof item === "object" && item !== null) {
        const record = item as Record<string, unknown>;
        const name = record.className ?? record.id;
        return typeof name === "string" ? name : null;
      }

      return null;
    })
    .filter((item): item is string => item !== null);
}

// ==========================================
// CUSTOM REACT FLOW NODE COMPONENT
// ==========================================

const CustomNetworkNode = ({ data }: NodeProps<ImpactGraphNode>) => {
  const isSelected = data.isSelected;
  const isImpacted = data.isImpacted;

  let borderColor = "border-cyan-500/40 hover:border-cyan-400";
  let bgColor = "bg-slate-900/90";
  let textColor = "text-slate-100";
  let glowStyle = "shadow-[0_0_15px_rgba(6,182,212,0.15)]";
  let badgeBg = "bg-cyan-950 text-cyan-300 border-cyan-800";

  if (isSelected) {
    borderColor = "border-amber-400 ring-2 ring-amber-400/50";
    bgColor = "bg-amber-950/80";
    textColor = "text-amber-100";
    glowStyle = "shadow-[0_0_25px_rgba(251,191,36,0.4)]";
    badgeBg = "bg-amber-900 text-amber-200 border-amber-600";
  } else if (isImpacted) {
    borderColor = "border-rose-500 ring-2 ring-rose-500/40";
    bgColor = "bg-rose-950/80";
    textColor = "text-rose-100";
    glowStyle = "shadow-[0_0_25px_rgba(244,63,94,0.4)]";
    badgeBg = "bg-rose-900 text-rose-200 border-rose-600";
  }

  return (
    <div
      className={`relative min-w-[220px] max-w-[260px] rounded-xl border ${borderColor} ${bgColor} ${glowStyle} p-3.5 backdrop-blur-md transition-all duration-300`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-cyan-400"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${
              isSelected
                ? "animate-ping bg-amber-400"
                : isImpacted
                ? "animate-pulse bg-rose-400"
                : "bg-cyan-400"
            }`}
          />
          <p className={`truncate text-xs font-bold tracking-wide ${textColor}`}>
            {data.label}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-mono font-semibold ${badgeBg}`}
        >
          {isSelected ? "TARGET" : isImpacted ? "AFFECTED" : "NODE"}
        </span>
      </div>

      {data.filePath && (
        <p className="mt-2 truncate font-mono text-[10px] text-slate-400">
          {data.filePath}
        </p>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2.5 !w-2.5 !border-2 !border-slate-900 !bg-cyan-400"
      />
    </div>
  );
};


function FitViewButton() {
  const { fitView } = useReactFlow();

  return (
    <Panel position="top-right">
      <button
        onClick={() => {
          void fitView({ padding: 0.2, duration: 400 });
        }}
        className="rounded-lg border border-cyan-500/50 bg-slate-900/95 px-3 py-2 text-xs font-semibold text-cyan-300 shadow-lg transition hover:bg-cyan-950"
      >
        ⛶ Fit to Screen
      </button>
    </Panel>
  );
}

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================

export default function Home() {
  const [nodes, setNodes] = useState<ImpactGraphNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [summary, setSummary] = useState<Summary>(initialSummary);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scanning, setScanning] = useState(false);
  const [repoUrl, setRepoUrl] = useState("");
  const [repoScanning, setRepoScanning] = useState(false);
  const [repoError, setRepoError] = useState("");

  const [selectedClass, setSelectedClass] = useState("");
  const [impactedClasses, setImpactedClasses] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [impactError, setImpactError] = useState("");
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [viewMode, setViewMode] = useState<"graph" | "list">("graph");
  // UI/UX Enhancements State
  const [enhancedUiMode, setEnhancedUiMode] = useState(true);
  const [nodeSearchQuery, setNodeSearchQuery] = useState("");

  const nodeTypes = useMemo(() => ({ custom: CustomNetworkNode }), []);
  const [activeProjectId, setActiveProjectId] = useState(2);
const API = `${API_BASE}/${activeProjectId}`;
  const applyHighlights = useCallback(
    (
      graphNodes: ImpactGraphNode[],
      selected: string,
      impacted: string[]
    ): ImpactGraphNode[] => {
      return graphNodes.map((node) => {
        const isSelected = node.id === selected;
        const isImpacted = impacted.includes(node.id);

        return {
          ...node,
          type: enhancedUiMode ? "custom" : undefined,
          data: {
            ...node.data,
            isSelected,
            isImpacted,
          },
          style: enhancedUiMode
            ? undefined
            : {
                ...node.style,
                background: isSelected
                  ? "#854d0e"
                  : isImpacted
                  ? "#7f1d1d"
                  : "#172554",
                color: "#e0e7ff",
                border: isSelected
                  ? "2px solid #facc15"
                  : isImpacted
                  ? "2px solid #f87171"
                  : "1px solid #3b82f6",
                borderRadius: 10,
                padding: 12,
                width: 210,
                fontSize: 12,
              },
        };
      });
    },
    [enhancedUiMode]
  );

  async function loadGraph() {
    try {
      setError("");

      const [graphResponse, summaryResponse] = await Promise.all([
        fetch(`${API}/graph`),
        fetch(`${API}/summary`),
      ]);

      if (!graphResponse.ok || !summaryResponse.ok) {
        throw new Error(
          "Could not load graph. Check that the backend is running."
        );
      }

      const graph: GraphData = await graphResponse.json();
      const stats = await summaryResponse.json();

      const newNodes: ImpactGraphNode[] = graph.nodes.map((item) => ({
        id: item.id,
        type: enhancedUiMode ? "custom" : undefined,
        position: { x: 0, y: 0 },
        data: {
          label: item.label,
          filePath: item.filePath,
        },
        style: {},
      }));

      const newEdges: Edge[] = graph.edges.map((item, index) => ({
        id: `${item.source}-${item.target}-${index}`,
        source: item.source,
        target: item.target,
        animated: true,
        style: {
          stroke: enhancedUiMode ? "#38bdf8" : "#60a5fa",
          strokeWidth: enhancedUiMode ? 2 : 1.5,
        },
      }));

      const positionedNodes = layoutGraph(newNodes, newEdges);

      setNodes(
        applyHighlights(
          positionedNodes,
          analysisComplete ? selectedClass : "",
          analysisComplete ? impactedClasses : []
        )
      );
      setEdges(newEdges);

      setSummary({
        totalClasses: Number(stats.totalClasses ?? graph.nodes.length),
        totalDependencies: Number(
          stats.totalDependencies ?? graph.edges.length
        ),
        mostDependentClasses: normalizeMostDependent(
          stats.mostDependentClasses
        ),
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading the graph."
      );
    } finally {
      setLoading(false);
    }
  }

  async function rescan() {
    setScanning(true);
    setError("");
    setImpactError("");
    setImpactedClasses([]);
    setAnalysisComplete(false);

    try {
      const response = await fetch(`${API}/graph`, { method: "POST" });

      if (!response.ok) {
        throw new Error("Project scan failed.");
      }

      setSelectedClass("");
      await loadGraph();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  async function analyzeImpact() {
    if (!selectedClass) return;

    setAnalyzing(true);
    setImpactError("");
    setImpactedClasses([]);
    setAnalysisComplete(false);

    try {
      const response = await fetch(
        `${API}/impact?className=${encodeURIComponent(selectedClass)}`
      );

      if (!response.ok) {
        throw new Error(`Impact analysis failed (${response.status}).`);
      }

      const data: unknown = await response.json();
      const impacted = normalizeImpacted(data);

      setImpactedClasses(impacted);
      setAnalysisComplete(true);

      setNodes((current) =>
        applyHighlights(current, selectedClass, impacted)
      );
    } catch (err) {
      setImpactError(
        err instanceof Error ? err.message : "Impact analysis failed."
      );
    } finally {
      setAnalyzing(false);
    }
  }

  
async function importGitHubRepository() {
  const url = repoUrl.trim();

  if (!url) {
    setRepoError("Enter a public GitHub repository URL.");
    return;
  }

  setRepoScanning(true);
  setRepoError("");
  setError("");
  setImpactError("");
  setSelectedClass("");
  setImpactedClasses([]);
  setAnalysisComplete(false);

  try {
    const response = await fetch(`${API_BASE}/github-import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repositoryUrl: url,
      }),
    });

    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(
        result?.message ||
          result?.error ||
          `Repository import failed (${response.status}).`
      );
    }

    if (
      !result ||
      typeof result.projectId !== "number"
    ) {
      throw new Error(
        "The backend did not return a valid project ID."
      );
    }

    setLoading(true);
    setActiveProjectId(result.projectId);
    setRepoUrl("");
  } catch (err) {
    setRepoError(
      err instanceof Error
        ? err.message
        : "GitHub import failed."
    );
  } finally {
    setRepoScanning(false);
  }
}


  function handleClassChange(value: string) {
    setSelectedClass(value);
    setImpactedClasses([]);
    setImpactError("");
    setAnalysisComplete(false);

    setNodes((current) => applyHighlights(current, value, []));
  }

  useEffect(() => {
    void loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enhancedUiMode, activeProjectId]);

  const filteredNodes = useMemo(() => {
    if (!nodeSearchQuery) return nodes;
    return nodes.filter(
      (n) =>
        n.id.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
        String(n.data.label).toLowerCase().includes(nodeSearchQuery.toLowerCase())
    );
  }, [nodes, nodeSearchQuery]);

  return (
    <main className="min-h-screen bg-slate-950 font-sans text-slate-100 antialiasedSelection">
      {/* COMMAND HEADER */}
      <header className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-950/50 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
            <svg
              className="h-5 w-5 text-cyan-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">
                Impact<span className="text-cyan-400">Graph</span>
              </h1>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                SYSTEM LIVE
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Dependency Reconstruction &amp; Change Impact Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setEnhancedUiMode(!enhancedUiMode)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
              enhancedUiMode
                ? "border-cyan-500/50 bg-cyan-950/40 text-cyan-300"
                : "border-slate-700 bg-slate-900 text-slate-400"
            }`}
            title="Toggle Visual Layout Engine"
          >
            {enhancedUiMode ? "✨ HUD UI Active" : "Legacy UI"}
          </button>

          <button
            onClick={rescan}
            disabled={scanning || loading}
            className="flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-600/20 px-4 py-2 text-xs font-semibold text-cyan-200 transition-all hover:border-cyan-400 hover:bg-cyan-600/30 hover:shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50"
          >
            <span className={scanning ? "animate-spin" : ""}>↻</span>
            {scanning ? "Scanning System..." : "Rescan Project"}
          </button>
        </div>
      </header>
      
      
<section className="px-6 pt-6">
  <div className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 sm:flex-row sm:items-start">
    <div className="flex-1">
      <label
        htmlFor="github-repo-url"
        className="mb-2 block text-sm font-medium text-slate-200"
      >
        Import public GitHub repository
      </label>

      <input
        id="github-repo-url"
        type="url"
        placeholder="https://github.com/owner/repo"
        value={repoUrl}
        onChange={(e) => {
          setRepoUrl(e.target.value);
          setRepoError("");
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !repoScanning) {
            void importGitHubRepository();
          }
        }}
        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-cyan-500 sm:max-w-xl"
      />

      {repoError && (
        <p className="mt-2 text-sm text-red-400">
          {repoError}
        </p>
      )}

      <p className="mt-2 text-xs text-slate-500">
        Paste a repository URL to build its dependency graph.
      </p>
    </div>

    <button
      type="button"
      onClick={() => void importGitHubRepository()}
      disabled={repoScanning || !repoUrl.trim()}
      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {repoScanning ? "Importing..." : "Import Repository"}
    </button>
  </div>
</section>

      {/* STATS HUD DASHBOARD */}
      <section className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Classes
            </p>
            <span className="h-2 w-2 rounded-full bg-blue-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-blue-400 font-mono">
            {summary.totalClasses}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-blue-500"
              style={{
                width: `${Math.min(100, (summary.totalClasses / 50) * 100)}%`,
              }}
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Total Dependencies
            </p>
            <span className="h-2 w-2 rounded-full bg-cyan-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-cyan-400 font-mono">
            {summary.totalDependencies}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-cyan-400"
              style={{
                width: `${Math.min(
                  100,
                  (summary.totalDependencies / 100) * 100
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Impacted Rate
            </p>
            <span className="h-2 w-2 rounded-full bg-rose-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-rose-400 font-mono">
            {summary.totalClasses > 0
              ? `${((impactedClasses.length / summary.totalClasses) * 100).toFixed(
                  0
                )}%`
              : "0%"}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full bg-rose-500"
              style={{
                width: `${
                  summary.totalClasses > 0
                    ? (impactedClasses.length / summary.totalClasses) * 100
                    : 0
                }%`,
              }}
            />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-md shadow-sm">
          <div className="flex justify-between items-start">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Avg Dependency Density
            </p>
            <span className="h-2 w-2 rounded-full bg-amber-400" />
          </div>
          <p className="mt-2 text-3xl font-extrabold tracking-tight text-amber-400 font-mono">
            {summary.totalClasses > 0
              ? (summary.totalDependencies / summary.totalClasses).toFixed(1)
              : "0.0"}
          </p>
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-800">
            <div className="h-full bg-amber-400" style={{ width: "65%" }} />
          </div>
        </div>
      </section>

      {/* ANALYSIS CONSOLE */}
      <section className="px-6 pb-6">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Change Impact Analysis Console</span>
              </h2>
              <p className="mt-1 text-xs text-slate-400">
                Select a class to discover downstream dependencies and code impact zones.
              </p>
            </div>

            <div className="w-full sm:w-64">
              <input
                type="text"
                placeholder="Filter class options..."
                value={nodeSearchQuery}
                onChange={(e) => setNodeSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <select
              value={selectedClass}
              onChange={(e) => handleClassChange(e.target.value)}
              className="min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 p-3 font-mono text-xs text-white focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            >
              <option value="">Select target class for impact assessment...</option>
              {filteredNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {String(node.data.label)} ({node.id})
                </option>
              ))}
            </select>

            <button
              onClick={analyzeImpact}
              disabled={!selectedClass || analyzing || loading}
              className="rounded-xl border border-amber-500/50 bg-amber-600/20 px-6 py-3 text-xs font-bold text-amber-200 transition-all hover:bg-amber-600/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.3)] disabled:opacity-40"
            >
              {analyzing ? "Simulating Impact..." : "Analyze Impact"}
            </button>
          </div>

          {impactError && (
            <div className="mt-3 rounded-lg border border-rose-900/50 bg-rose-950/30 p-3 text-xs text-rose-300">
              {impactError}
            </div>
          )}

          {analysisComplete && (
            <div className="mt-4 rounded-xl border border-rose-900/60 bg-rose-950/20 p-4 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-rose-300 uppercase tracking-wide">
                  Analysis Complete: {impactedClasses.length} Affected Component(s)
                </p>
              </div>

              {impactedClasses.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {impactedClasses.map((name) => (
                    <span
                      key={name}
                      className="rounded-md border border-rose-800/60 bg-rose-900/40 px-2.5 py-1 font-mono text-xs font-medium text-rose-200"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-400">
                  No affected downstream classes detected.
                </p>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Selected Focus
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-500" /> Downstream Affected
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-cyan-500" /> Active Edge
            </span>
          </div>
        </div>
      </section>

      {/* RANKING & DEPENDENCY LIST */}
      <section className="px-6 pb-6">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-6 backdrop-blur-md">
          <h2 className="text-base font-bold text-white">
            Most Depended-On Classes
          </h2>
          <p className="mb-4 mt-1 text-xs text-slate-400">
            Critical infrastructure components sorted by incoming connection density.
          </p>

          {summary.mostDependentClasses.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {summary.mostDependentClasses.slice(0, 6).map((item) => {
                const maxCount = summary.mostDependentClasses[0]?.count || 1;
                const percentage = Math.round((item.count / maxCount) * 100);

                return (
                  <div
                    key={item.className}
                    onClick={() => handleClassChange(item.className)}
                    className="group cursor-pointer rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 transition-all hover:border-cyan-500/40 hover:bg-slate-900"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                        {item.className}
                      </span>
                      <span className="shrink-0 rounded-md bg-cyan-950 border border-cyan-800 px-2 py-0.5 font-mono text-[11px] font-bold text-cyan-300">
                        {item.count}
                      </span>
                    </div>

                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500">
              No dependency ranking data available.
            </p>
          )}
        </div>
      </section>

      {/* MAIN GRAPH/LIST VIEWPORT */}
      <section className="px-6 pb-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-white">
              Dependency Topology &amp; Visualizer
            </h2>
            <p className="text-xs text-slate-400">
              Interactive structural graph view and reverse impact pipeline.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button
                onClick={() => setViewMode("graph")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "graph"
                    ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Graph View
              </button>

              <button
                onClick={() => setViewMode("list")}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  viewMode === "list"
                    ? "bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                Impact List
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-800/80 bg-rose-950/40 p-4 text-xs text-rose-300 backdrop-blur-md">
            {error}
          </div>
        )}

        <div className="min-h-[500px] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-md shadow-2xl">
          {loading ? (
            <div className="flex h-[500px] items-center justify-center text-xs text-slate-400 font-mono">
              <span className="animate-pulse">Loading dependency graph structure...</span>
            </div>
          ) : error ? (
            <div className="p-6 text-xs text-rose-300">{error}</div>
          ) : viewMode === "graph" ? (
            <div className="h-[650px] w-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodeClick={(_, node) => handleClassChange(node.id)}
                fitView
                minZoom={0.1}
                className="bg-slate-950"
              >
                <Background color="#1e293b" gap={24} size={1} />
                <Controls className="!border-slate-800 !bg-slate-900 !fill-slate-200 !text-slate-200 shadow-lg [&>button]:!border-b-slate-800 [&>button]:!bg-slate-900 [&>button]:!fill-slate-200 [&>button:hover]:!bg-slate-800" />
                <FitViewButton />
              </ReactFlow>
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {!selectedClass ? (
                <div className="rounded-xl border border-dashed border-slate-800 p-8 text-center text-xs text-slate-400">
                  Select a class in Change Impact Analysis above to inspect impact pipeline details.
                </div>
              ) : !analysisComplete ? (
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-xs text-slate-400">
                  Selected class:{" "}
                  <span className="font-mono font-bold text-amber-400">
                    {selectedClass}
                  </span>
                  . Click <strong className="text-white">Analyze Impact</strong> to process direct dependencies.
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      Root Impact Target
                    </p>
                    <p className="mt-1 font-mono text-sm font-semibold text-white">
                      {selectedClass}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-semibold text-rose-400">
                      {impactedClasses.length} Affected Classes
                    </span>
                    <span>·</span>
                    <span>Reverse Dependency Pipeline</span>
                  </div>

                  {impactedClasses.length === 0 ? (
                    <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-6 text-xs text-slate-400">
                      No affected downstream classes found for this component.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {impactedClasses.map((name, index) => {
                        const graphNode = nodes.find((node) => node.id === name);

                        return (
                          <div key={name}>
                            <div className="flex items-center gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-rose-800 bg-rose-950/60 font-mono text-xs font-bold text-rose-300">
                                {index + 1}
                              </div>

                              <div className="min-w-0 flex-1 rounded-xl border border-rose-900/50 bg-rose-950/20 p-3.5 backdrop-blur-sm">
                                <p className="font-mono text-xs font-bold text-rose-200">
                                  {graphNode?.data.label ?? name}
                                </p>

                                <p className="mt-0.5 truncate font-mono text-[11px] text-slate-400">
                                  {name}
                                </p>

                                {graphNode?.data.filePath && (
                                  <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                                    📁 {String(graphNode.data.filePath)}
                                  </p>
                                )}
                              </div>
                            </div>

                            {index < impactedClasses.length - 1 && (
                              <div className="ml-3.5 h-3 border-l border-dashed border-rose-800/60" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

