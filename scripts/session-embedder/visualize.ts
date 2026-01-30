#!/usr/bin/env ts-node
/**
 * Qdrant Knowledge Graph Visualizer
 *
 * Extracts all embeddings from Qdrant, applies UMAP dimensionality reduction,
 * and generates an interactive HTML visualization using Plotly.js.
 *
 * Usage: npm run session:visualize
 */

import * as fs from 'fs';
import * as path from 'path';
import { UMAP } from 'umap-js';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'session-embeddings';
const OUTPUT_DIR = path.join(__dirname, '../../.claude/visualizations');

interface QdrantPoint {
  id: number;
  vector: number[];
  payload: {
    id: string;
    session_id: string;
    date: string;
    chunk_index: number;
  };
}

interface VisualizationPoint {
  x: number;
  y: number;
  session_id: string;
  date: string;
  chunk_index: number;
  original_id: string;
}

/**
 * Fetch all points from Qdrant with their vectors
 */
async function fetchAllPoints(): Promise<QdrantPoint[]> {
  const allPoints: QdrantPoint[] = [];
  let offset: number | null = null;
  const batchSize = 100;

  console.log('📥 Fetching points from Qdrant...');

  while (true) {
    const url = `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/scroll`;
    const body: any = {
      limit: batchSize,
      with_payload: true,
      with_vector: true,
    };

    if (offset !== null) {
      body.offset = offset;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch points: ${response.statusText}`);
    }

    const data = await response.json() as any;
    const points = data.result.points as QdrantPoint[];

    if (points.length === 0) break;

    allPoints.push(...points);
    process.stdout.write(`\r  Fetched ${allPoints.length} points...`);

    offset = data.result.next_page_offset;
    if (!offset) break;
  }

  console.log(`\n✅ Total points fetched: ${allPoints.length}`);
  return allPoints;
}

/**
 * Apply UMAP dimensionality reduction
 */
function applyUMAP(vectors: number[][], options?: {
  nNeighbors?: number;
  minDist?: number;
  nComponents?: number;
}): number[][] {
  const nNeighbors = options?.nNeighbors || 15;
  const minDist = options?.minDist || 0.1;
  const nComponents = options?.nComponents || 2;

  console.log(`\n🔄 Applying UMAP (neighbors=${nNeighbors}, minDist=${minDist})...`);
  console.log('   This may take a few minutes for large datasets...');

  const startTime = Date.now();

  const umap = new UMAP({
    nNeighbors,
    minDist,
    nComponents,
    spread: 1.0,
  });

  const embedding = umap.fit(vectors);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`✅ UMAP complete in ${elapsed}s`);

  return embedding;
}

/**
 * Generate color palette for sessions
 */
function generateColors(count: number): string[] {
  const colors: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = (i * 137.508) % 360; // Golden angle for good distribution
    colors.push(`hsl(${hue}, 70%, 50%)`);
  }
  return colors;
}

/**
 * Generate the HTML visualization
 */
function generateHTML(points: VisualizationPoint[], sessions: string[]): string {
  const colors = generateColors(sessions.length);
  const sessionColorMap = Object.fromEntries(sessions.map((s, i) => [s, colors[i]]));

  // Group points by session
  const traces = sessions.map((sessionId, idx) => {
    const sessionPoints = points.filter(p => p.session_id === sessionId);
    return {
      x: sessionPoints.map(p => p.x),
      y: sessionPoints.map(p => p.y),
      mode: 'markers',
      type: 'scatter',
      name: sessionId.substring(0, 20) + (sessionId.length > 20 ? '...' : ''),
      text: sessionPoints.map(p =>
        `Session: ${p.session_id}<br>Date: ${new Date(p.date).toLocaleDateString()}<br>Chunk: ${p.chunk_index}`
      ),
      hoverinfo: 'text',
      marker: {
        size: 6,
        color: colors[idx],
        opacity: 0.7,
      },
    };
  });

  const layout = {
    title: {
      text: 'Qdrant Knowledge Graph Visualization',
      font: { size: 24, color: '#333' }
    },
    showlegend: true,
    legend: {
      orientation: 'v',
      x: 1.02,
      y: 1,
      bgcolor: 'rgba(255,255,255,0.9)',
      bordercolor: '#ccc',
      borderwidth: 1,
    },
    xaxis: {
      title: 'UMAP Dimension 1',
      showgrid: true,
      gridcolor: '#eee',
      zeroline: false,
    },
    yaxis: {
      title: 'UMAP Dimension 2',
      showgrid: true,
      gridcolor: '#eee',
      zeroline: false,
    },
    hovermode: 'closest',
    paper_bgcolor: '#fafafa',
    plot_bgcolor: '#fff',
    margin: { l: 60, r: 200, t: 80, b: 60 },
  };

  const config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['lasso2d', 'select2d'],
    displaylogo: false,
  };

  const stats = {
    totalPoints: points.length,
    totalSessions: sessions.length,
    dateRange: {
      earliest: new Date(Math.min(...points.map(p => new Date(p.date).getTime()))).toLocaleDateString(),
      latest: new Date(Math.max(...points.map(p => new Date(p.date).getTime()))).toLocaleDateString(),
    }
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qdrant Knowledge Graph</title>
  <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 30px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 1.8rem; margin-bottom: 5px; }
    .header p { opacity: 0.9; font-size: 0.95rem; }
    .stats-bar {
      display: flex;
      gap: 30px;
      padding: 15px 30px;
      background: white;
      border-bottom: 1px solid #eee;
    }
    .stat {
      display: flex;
      flex-direction: column;
    }
    .stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #333;
    }
    .stat-label {
      font-size: 0.8rem;
      color: #888;
      text-transform: uppercase;
    }
    .controls {
      padding: 15px 30px;
      background: white;
      border-bottom: 1px solid #eee;
      display: flex;
      gap: 20px;
      align-items: center;
      flex-wrap: wrap;
    }
    .control-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .control-group label {
      font-size: 0.9rem;
      color: #555;
    }
    .control-group input, .control-group select {
      padding: 6px 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.9rem;
    }
    .btn {
      padding: 8px 16px;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background 0.2s;
    }
    .btn:hover { background: #5a6fd6; }
    .btn-secondary {
      background: #6c757d;
    }
    .btn-secondary:hover { background: #5a6268; }
    #chart {
      width: 100%;
      height: calc(100vh - 200px);
      min-height: 500px;
    }
    .search-box {
      display: flex;
      gap: 10px;
      flex: 1;
      max-width: 400px;
    }
    .search-box input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🧠 Qdrant Knowledge Graph</h1>
    <p>Interactive visualization of ${stats.totalPoints.toLocaleString()} embedded session chunks</p>
  </div>

  <div class="stats-bar">
    <div class="stat">
      <span class="stat-value">${stats.totalPoints.toLocaleString()}</span>
      <span class="stat-label">Total Chunks</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.totalSessions}</span>
      <span class="stat-label">Sessions</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.dateRange.earliest}</span>
      <span class="stat-label">Earliest</span>
    </div>
    <div class="stat">
      <span class="stat-value">${stats.dateRange.latest}</span>
      <span class="stat-label">Latest</span>
    </div>
  </div>

  <div class="controls">
    <div class="search-box">
      <input type="text" id="sessionSearch" placeholder="Filter sessions..." />
      <button class="btn" onclick="filterSessions()">Filter</button>
      <button class="btn btn-secondary" onclick="resetFilter()">Reset</button>
    </div>
    <div class="control-group">
      <label>Point Size:</label>
      <input type="range" id="pointSize" min="2" max="15" value="6" onchange="updatePointSize()" />
    </div>
    <div class="control-group">
      <label>Opacity:</label>
      <input type="range" id="opacity" min="0.1" max="1" step="0.1" value="0.7" onchange="updateOpacity()" />
    </div>
  </div>

  <div id="chart"></div>

  <script>
    const allTraces = ${JSON.stringify(traces)};
    const layout = ${JSON.stringify(layout)};
    const config = ${JSON.stringify(config)};
    let currentTraces = [...allTraces];

    // Initial render
    Plotly.newPlot('chart', currentTraces, layout, config);

    function filterSessions() {
      const query = document.getElementById('sessionSearch').value.toLowerCase();
      if (!query) {
        currentTraces = [...allTraces];
      } else {
        currentTraces = allTraces.filter(t => t.name.toLowerCase().includes(query));
      }
      Plotly.react('chart', currentTraces, layout, config);
    }

    function resetFilter() {
      document.getElementById('sessionSearch').value = '';
      currentTraces = [...allTraces];
      Plotly.react('chart', currentTraces, layout, config);
    }

    function updatePointSize() {
      const size = parseInt(document.getElementById('pointSize').value);
      currentTraces.forEach(t => { t.marker.size = size; });
      Plotly.react('chart', currentTraces, layout, config);
    }

    function updateOpacity() {
      const opacity = parseFloat(document.getElementById('opacity').value);
      currentTraces.forEach(t => { t.marker.opacity = opacity; });
      Plotly.react('chart', currentTraces, layout, config);
    }

    // Handle window resize
    window.addEventListener('resize', () => {
      Plotly.Plots.resize('chart');
    });
  </script>
</body>
</html>`;
}

/**
 * Main execution
 */
async function main() {
  console.log('\n🧠 Qdrant Knowledge Graph Visualizer\n');
  console.log('=' .repeat(50));

  try {
    // 1. Fetch all points
    const points = await fetchAllPoints();

    if (points.length === 0) {
      console.error('❌ No points found in Qdrant collection');
      process.exit(1);
    }

    // 2. Extract vectors and metadata
    const vectors = points.map(p => p.vector);
    const metadata = points.map(p => ({
      session_id: p.payload.session_id,
      date: p.payload.date,
      chunk_index: p.payload.chunk_index,
      original_id: p.payload.id,
    }));

    // Get unique sessions
    const sessions = [...new Set(metadata.map(m => m.session_id))].sort();
    console.log(`\n📊 Found ${sessions.length} unique sessions`);

    // 3. Apply UMAP
    const embedding = applyUMAP(vectors);

    // 4. Combine results
    const vizPoints: VisualizationPoint[] = embedding.map((coords, i) => ({
      x: coords[0],
      y: coords[1],
      ...metadata[i],
    }));

    // 5. Generate HTML
    console.log('\n📝 Generating HTML visualization...');
    const html = generateHTML(vizPoints, sessions);

    // 6. Write output
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const outputPath = path.join(OUTPUT_DIR, 'knowledge-graph.html');
    fs.writeFileSync(outputPath, html);

    console.log(`\n✅ Visualization saved to:\n   ${outputPath}`);
    console.log('\n🌐 Open in browser to explore your knowledge graph!');
    console.log(`   file://${outputPath.replace(/\\/g, '/')}`);

    // Also save JSON data for potential future use
    const dataPath = path.join(OUTPUT_DIR, 'visualization-data.json');
    fs.writeFileSync(dataPath, JSON.stringify({
      points: vizPoints,
      sessions,
      generatedAt: new Date().toISOString(),
      stats: {
        totalPoints: points.length,
        totalSessions: sessions.length,
      }
    }, null, 2));
    console.log(`   Data also saved to: ${dataPath}`);

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
