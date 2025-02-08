"use client";

import { useEffect } from "react";
import Head from "next/head";
import Chart from "chart.js/auto";
import ChartDataLabels from "chartjs-plugin-datalabels";
// IMPORTANT: Use SankeyController + Flow (not SankeyTooltip) for v0.14.0:
import { SankeyController, Flow } from "chartjs-chart-sankey";

export default function Home() {
  useEffect(() => {
    // Dynamically import the zoom plugin to avoid SSR issues with window/hammerjs
    async function registerPlugins() {
      const { default: zoom } = await import("chartjs-plugin-zoom");
      // Register all the Chart.js plugins
      Chart.register(
        ChartDataLabels,
        zoom,
        SankeyController,
        Flow
      );
    }
    registerPlugins();

    // ========================
    // Initialization Code
    // ========================

    // --- State Management ---
    const trackingState = {
      zoom: 1,
      trackingData: { nodes: [], connections: [] }
    };
    const MIN_WIDTH = 40, MIN_HEIGHT = 30, SNAP_THRESHOLD = 25;
    let undoStack = [], redoStack = [], selectedElement = null, currentAction = null, interactionOverlay = null;
    let chatMessages = [], aiAttachments = [];
    let conversationHistory = [
      {
        role: "system",
        content: "You are a highly advanced AI model specializing in data analysis and visualization. Your mission is to analyze datasets and produce insightful, accurate, and detailed textual reports as well as creative visualizations. You have full access to and must leverage the capabilities of the following libraries: 1. Chart.js (https://cdn.jsdelivr.net/npm/chart.js) - Supports a wide range of chart types including: bar, line, area, radar, bubble, scatter, pie, doughnut, polar area, mixed charts, and even custom or hybrid visualizations. - Features responsive design, smooth animations, tooltips, legends, multi-axis configurations, and custom controllers for building entirely new chart types. - Accepts various data structures (arrays, objects with {x, y} or custom keys) and can use built-in parsing options to convert custom data formats. 2. chartjs-plugin-datalabels (https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels) - Displays data labels on any chart element with extensive customization options. - Allows scriptable options to control font, size, color, alignment, and formatting of labels. - Enhances readability by annotating chart elements directly with their corresponding data values. 3. chartjs-plugin-zoom (https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom) - Enables interactive zooming and panning on charts. - Supports zoom via mouse wheel, pinch gestures, and drag-to-zoom with configurable modes (x, y, xy) and limits. - Provides event callbacks (onZoom, onPan, etc.) to further control interactivity. 4. chartjs-chart-sankey (https://cdn.jsdelivr.net/npm/chartjs-chart-sankey) - Specializes in rendering Sankey diagrams to visualize flows and connections. - Uses custom data structures with keys such as 'from', 'to', and 'flow' (or custom mappings via parsing options) to represent directional relationships. - Offers customizable color gradients, node labels, priorities, and column overrides to accurately depict complex flow networks. Additional Instructions: - **Data Structure Flexibility:** You are not limited to basic numerical arrays. You must be able to ingest and parse any data structure (e.g., objects with custom keys) by using Chart.js’s parsing options or custom controllers. - **Creative Visualization:** Do not default to any one chart type (e.g., bar charts). Instead, choose the most insightful and appropriate visualization from the full range available. You may combine or mix chart types if that best represents the data. - **Accuracy and Granularity:** Ensure that all data is validated, all calculations are correct, and every detail (labels, colors, axes) is thoroughly verified for clarity and correctness. - **Legibility and Interactivity:** Visualizations must be easy to read and understand. Use data labels, interactive zooming/panning, and custom formatting as needed to optimize the user experience. Response Formats: You must return one of the following: - **Textual Insight:** \`\`\`json { 'responseType': 'text', 'responseValue': 'someText' } \`\`\` - **Chart-Based Visualization (in Valid JSON):** \`\`\`json { 'responseType': 'chart', 'responseValue': { 'type': '',  // Choose the most suitable chart type (or combination) from the full range provided by Chart.js and its plugins. 'data': { 'labels': [], 'datasets': [ { 'label': '', 'data': [], 'backgroundColor': [], 'borderColor': [], 'borderWidth': 1 } ] }, 'options': { 'responsive': true, 'maintainAspectRatio': false, 'scales': { 'x': { 'title': { 'display': true, 'text': '', 'color': '#333', 'font': { 'size': 14, 'weight': 'bold' } } }, 'y': { 'beginAtZero': true, 'title': { 'display': true, 'text': '', 'color': '#333', 'font': { 'size': 14, 'weight': 'bold' } } } }, 'plugins': { 'title': { 'display': true, 'text': '', 'color': '#111', 'font': { 'size': 16, 'weight': 'bold' } }, 'datalabels': { 'color': '#fff', 'align': 'end', 'anchor': 'end' }, 'zoom': { 'zoom': { 'wheel': { 'enabled': true }, 'pinch': { 'enabled': true }, 'mode': 'xy' } } } } } } \`\`\` Decision Logic: - **Text Output:** Use when the user asks for general insights or when the dataset does not warrant a visualization. - **Chart Output:** Use when the user requests to see, visualize, or plot data, or when the dataset contains numerical/categorical variables that can be graphically represented. Choose the chart type(s) that best capture the trends, relationships, or flows in the data. Your task is to push the boundaries of data visualization by using any available chart type or custom hybrid visualization supported by these libraries to represent the data in the most clear and insightful manner possible. All visualizations must be thoroughly validated, accurate, and designed for human readability and interactivity."
      }
    ];
    const OPENAI_API_KEY = "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"; // Replace with your API key

    // --- DOM References ---
    const boardEl = document.getElementById("board");
    const svgLayer = document.getElementById("connection-layer");
    const boardContainer = document.getElementById("board-container");
    const aiPanel = document.getElementById("ai-panel");
    const resizer = document.getElementById("resizer");
    const chatMessagesEl = document.getElementById("chat-messages");
    const chatInputEl = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const attachmentPreviewEl = document.getElementById("attachment-preview");
    const aiAttachmentInput = document.getElementById("ai-attachment-input");

    // --- Utility Functions ---
    function generateId(prefix = "id") {
      return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    }
    function saveToLocalStorage() {
      localStorage.setItem("collabBoardState", JSON.stringify(trackingState));
    }
    function loadFromLocalStorage() {
      const state = localStorage.getItem("collabBoardState");
      if (state) {
        const parsed = JSON.parse(state);
        trackingState.zoom = parsed.zoom || 1;
        const data = parsed.trackingData || {};
        trackingState.trackingData = { nodes: data.nodes || [], connections: data.connections || [] };
      }
    }
    function pushUndo() {
      undoStack.push(JSON.stringify(trackingState));
      redoStack = [];
    }
    function restoreState(stateString) {
      const st = JSON.parse(stateString);
      trackingState.zoom = st.zoom;
      trackingState.trackingData = st.trackingData || { nodes: [], connections: [] };
      applyZoom();
      renderNodes();
      saveToLocalStorage();
    }

    // --- Node Rendering & Connection Drawing ---
    function renderNodes() {
      boardEl.innerHTML = "";
      trackingState.trackingData.nodes.forEach((node) => boardEl.appendChild(createNodeElement(node)));
      redrawConnections();
    }
    function createNodeElement(node) {
      const el = document.createElement("div");
      el.classList.add("node-item");
      el.dataset.id = node.id;
      el.style.left = node.x + "px";
      el.style.top = node.y + "px";
      el.style.width = node.width + "px";
      el.style.height = node.height + "px";

      const header = document.createElement("div");
      header.classList.add("node-header");
      header.addEventListener("mousedown", onNodeHeaderMouseDown);
      header.addEventListener("dblclick", onNodeHeaderDblClick);
      header.textContent = (node.chartConfig && node.chartConfig.options?.plugins?.title?.text) || "Chart";
      el.appendChild(header);

      const contentDiv = document.createElement("div");
      contentDiv.classList.add("node-content");
      const canvas = document.createElement("canvas");
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      contentDiv.appendChild(canvas);
      // Initialize Chart.js on the canvas
      setTimeout(() => new Chart(canvas, node.chartConfig), 0);
      el.appendChild(contentDiv);

      // Add connectors
      const connectorPositions = {
        top: { left: "50%", top: "-9px", transform: "translateX(-50%)", label: "↑" },
        bottom: { left: "50%", bottom: "-9px", transform: "translateX(-50%)", label: "↓" },
        left: { left: "-9px", top: "50%", transform: "translateY(-50%)", label: "←" },
        right: { right: "-9px", top: "50%", transform: "translateY(-50%)", label: "→" }
      };
      for (const side in connectorPositions) {
        const cEl = document.createElement("div");
        cEl.classList.add("connector");
        cEl.dataset.handle = side;
        Object.entries(connectorPositions[side]).forEach(([prop, val]) => {
          if (prop !== "label") cEl.style[prop] = val;
        });
        cEl.textContent = connectorPositions[side].label;
        cEl.addEventListener("mousedown", onConnectorMouseDown);
        el.appendChild(cEl);
      }

      // Resize handle
      const resizeHandle = document.createElement("div");
      resizeHandle.classList.add("resize-handle");
      resizeHandle.addEventListener("mousedown", onResizeHandleMouseDown);
      el.appendChild(resizeHandle);

      el.addEventListener("click", (evt) => {
        evt.stopPropagation();
        selectElement(el);
      });
      return el;
    }
    function redrawConnections() {
      while (svgLayer.lastChild && svgLayer.lastChild.tagName !== "defs") {
        svgLayer.removeChild(svgLayer.lastChild);
      }
      trackingState.trackingData.connections.forEach((conn) => svgLayer.appendChild(createConnectionPath(conn)));
    }
    function createConnectionPath(conn) {
      const fromPos = getConnectorAbsolutePosition(conn.from.nodeId, conn.from.handle);
      const toPos = getConnectorAbsolutePosition(conn.to.nodeId, conn.to.handle);
      const dAttr = `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
      const groupEl = document.createElementNS("http://www.w3.org/2000/svg", "g");
      groupEl.classList.add("connection-line");
      groupEl.dataset.id = conn.id;
      const hitPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      hitPath.setAttribute("d", dAttr);
      hitPath.setAttribute("stroke", "transparent");
      hitPath.setAttribute("stroke-width", "10");
      hitPath.setAttribute("fill", "none");
      const visiblePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      visiblePath.setAttribute("d", dAttr);
      visiblePath.setAttribute("stroke", "#555");
      visiblePath.setAttribute("stroke-width", "2");
      visiblePath.setAttribute("fill", "none");
      visiblePath.setAttribute("marker-end", "url(#arrowhead)");
      groupEl.appendChild(hitPath);
      groupEl.appendChild(visiblePath);
      groupEl.addEventListener("click", (e) => {
        e.stopPropagation();
        selectElement(groupEl);
      });
      return groupEl;
    }
    function updateConnectionsForNode(nodeId) {
      trackingState.trackingData.connections.forEach((conn) => {
        if (conn.from.nodeId === nodeId || conn.to.nodeId === nodeId) {
          const groupEl = svgLayer.querySelector(`.connection-line[data-id="${conn.id}"]`);
          if (groupEl) {
            const fromPos = getConnectorAbsolutePosition(conn.from.nodeId, conn.from.handle);
            const toPos = getConnectorAbsolutePosition(conn.to.nodeId, conn.to.handle);
            const newD = `M ${fromPos.x} ${fromPos.y} L ${toPos.x} ${toPos.y}`;
            groupEl.querySelectorAll("path").forEach((path) => path.setAttribute("d", newD));
          }
        }
      });
    }
    function selectElement(el) {
      if (selectedElement) selectedElement.classList.remove("selected");
      selectedElement = el;
      if (selectedElement) selectedElement.classList.add("selected");
    }
    function clearSelection() {
      if (selectedElement) selectedElement.classList.remove("selected");
      selectedElement = null;
    }
    document.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName) || document.activeElement.isContentEditable)
        return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        document.getElementById("undo").click();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        document.getElementById("redo").click();
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedElement) {
          e.preventDefault();
          deleteSelected();
        }
      }
    });
    document.getElementById("delete-selected").addEventListener("click", deleteSelected);
    function deleteSelected() {
      if (!selectedElement) return;
      pushUndo();
      if (selectedElement.classList.contains("node-item")) {
        const id = selectedElement.dataset.id;
        trackingState.trackingData.nodes = trackingState.trackingData.nodes.filter((n) => n.id !== id);
        trackingState.trackingData.connections = trackingState.trackingData.connections.filter((c) =>
          c.from.nodeId !== id && c.to.nodeId !== id
        );
      } else if (selectedElement.classList.contains("connection-line")) {
        const cid = selectedElement.dataset.id;
        trackingState.trackingData.connections = trackingState.trackingData.connections.filter((c) => c.id !== cid);
      }
      clearSelection();
      renderNodes();
      saveToLocalStorage();
    }
    document.getElementById("undo").addEventListener("click", () => {
      if (undoStack.length > 0) {
        redoStack.push(JSON.stringify(trackingState));
        restoreState(undoStack.pop());
      }
    });
    document.getElementById("redo").addEventListener("click", () => {
      if (redoStack.length > 0) {
        undoStack.push(JSON.stringify(trackingState));
        restoreState(redoStack.pop());
      }
    });
    function processOtherGraph(data) {
      const chartWidth = 800, chartHeight = 600;
      let newX = boardContainer.scrollLeft / trackingState.zoom + boardContainer.clientWidth / (2 * trackingState.zoom) - chartWidth / 2;
      let newY = boardContainer.scrollTop / trackingState.zoom + boardContainer.clientHeight / (2 * trackingState.zoom) - chartHeight / 2;
      const newId = generateId("otherGraph");
      const newNode = {
        id: newId,
        type: "otherGraph",
        x: newX,
        y: newY,
        width: chartWidth,
        height: chartHeight,
        chartConfig: data
      };
      const offset = findSpawnOffset([newNode]);
      newNode.x += offset.offsetX;
      newNode.y += offset.offsetY;
      trackingState.trackingData.nodes.push(newNode);
      renderNodes();
      saveToLocalStorage();
      document.getElementById("reset-zoom").click();
    }
    function displayErrorMessage(message) {
      let errorDiv = document.getElementById("error-message");
      if (!errorDiv) {
        errorDiv = document.createElement("div");
        errorDiv.id = "error-message";
        document.body.appendChild(errorDiv);
      }
      errorDiv.textContent = message;
      setTimeout(() => {
        if (errorDiv.parentNode) errorDiv.parentNode.removeChild(errorDiv);
      }, 3000);
    }
    function onNodeHeaderMouseDown(e) {
      if (currentAction !== null) return;
      if (e.target.classList.contains("connector") || e.target.classList.contains("resize-handle"))
        return;
      const nodeItem = e.currentTarget.closest(".node-item");
      if (!nodeItem) return;
      pushUndo();
      clearSelection();
      selectElement(nodeItem);
      startInteraction();
      const rect = nodeItem.getBoundingClientRect();
      currentAction = {
        type: "drag",
        el: nodeItem,
        offsetX: e.clientX - rect.left,
        offsetY: e.clientY - rect.top,
        nodeId: nodeItem.dataset.id
      };
      window.addEventListener("mousemove", onNodeDragMouseMove);
      window.addEventListener("mouseup", onNodeDragMouseUp);
    }
    function onNodeDragMouseMove(e) {
      if (!currentAction || currentAction.type !== "drag") return;
      const boardRect = boardContainer.getBoundingClientRect();
      const newX = (e.clientX - currentAction.offsetX - boardRect.left + boardContainer.scrollLeft) / trackingState.zoom;
      const newY = (e.clientY - currentAction.offsetY - boardRect.top + boardContainer.scrollTop) / trackingState.zoom;
      currentAction.el.style.left = newX + "px";
      currentAction.el.style.top = newY + "px";
      updateConnectionsForNode(currentAction.nodeId);
    }
    function onNodeDragMouseUp() {
      if (!currentAction || currentAction.type !== "drag") return;
      const nodeObj = trackingState.trackingData.nodes.find(n => n.id === currentAction.nodeId);
      if (nodeObj) {
        nodeObj.x = parseFloat(currentAction.el.style.left);
        nodeObj.y = parseFloat(currentAction.el.style.top);
      }
      window.removeEventListener("mousemove", onNodeDragMouseMove);
      window.removeEventListener("mouseup", onNodeDragMouseUp);
      currentAction = null;
      endInteraction();
      saveToLocalStorage();
    }
    function onResizeHandleMouseDown(e) {
      if (currentAction !== null) return;
      e.stopPropagation();
      const nodeItem = e.currentTarget.closest(".node-item");
      if (!nodeItem) return;
      pushUndo();
      clearSelection();
      selectElement(nodeItem);
      startInteraction();
      const rect = nodeItem.getBoundingClientRect();
      currentAction = {
        type: "resize",
        el: nodeItem,
        startX: e.clientX,
        startY: e.clientY,
        origW: rect.width,
        origH: rect.height,
        nodeId: nodeItem.dataset.id
      };
      window.addEventListener("mousemove", onResizeMouseMove);
      window.addEventListener("mouseup", onResizeMouseUp);
      e.preventDefault();
    }
    function onResizeMouseMove(e) {
      if (!currentAction || currentAction.type !== "resize") return;
      let newW = (currentAction.origW + (e.clientX - currentAction.startX)) / trackingState.zoom;
      let newH = (currentAction.origH + (e.clientY - currentAction.startY)) / trackingState.zoom;
      const nodeObj = trackingState.trackingData.nodes.find(n => n.id === currentAction.nodeId);
      if (!nodeObj) return;
      const effectiveMinW = typeof nodeObj.minWidth === "number" ? nodeObj.minWidth : MIN_WIDTH;
      const effectiveMinH = typeof nodeObj.minHeight === "number" ? nodeObj.minHeight : MIN_HEIGHT;
      newW = Math.max(newW, effectiveMinW);
      newH = Math.max(newH, effectiveMinH);
      currentAction.el.style.width = newW + "px";
      currentAction.el.style.height = newH + "px";
      updateConnectionsForNode(currentAction.nodeId);
    }
    function onResizeMouseUp() {
      if (!currentAction || currentAction.type !== "resize") return;
      const nodeObj = trackingState.trackingData.nodes.find(n => n.id === currentAction.nodeId);
      if (nodeObj) {
        nodeObj.width = parseFloat(currentAction.el.style.width);
        nodeObj.height = parseFloat(currentAction.el.style.height);
      }
      window.removeEventListener("mousemove", onResizeMouseMove);
      window.removeEventListener("mouseup", onResizeMouseUp);
      currentAction = null;
      endInteraction();
      saveToLocalStorage();
    }
    function onNodeHeaderDblClick(e) {
      e.stopPropagation();
      const header = e.currentTarget;
      const currentText = header.textContent;
      const input = document.createElement("input");
      input.type = "text";
      input.value = currentText;
      input.style.width = "100%";
      header.innerHTML = "";
      header.appendChild(input);
      input.focus();
      input.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") finishNodeHeaderEditing(input, header);
      });
      input.addEventListener("blur", () => finishNodeHeaderEditing(input, header));
    }
    function finishNodeHeaderEditing(input, header) {
      const newText = input.value.trim() || "Untitled";
      header.textContent = newText;
      const nodeEl = header.closest(".node-item");
      const nodeObj = trackingState.trackingData.nodes.find(n => n.id === nodeEl.dataset.id);
      if (nodeObj) {
        nodeObj.title = newText;
        if (nodeObj.chartConfig && nodeObj.chartConfig.options) {
          nodeObj.chartConfig.options.plugins = nodeObj.chartConfig.options.plugins || {};
          nodeObj.chartConfig.options.plugins.title = nodeObj.chartConfig.options.plugins.title || {};
          nodeObj.chartConfig.options.plugins.title.text = newText;
        }
      }
      saveToLocalStorage();
    }
    function onConnectorMouseDown(e) {
      if (currentAction !== null) return;
      pushUndo();
      startInteraction();
      const connectorEl = e.currentTarget;
      const nodeEl = connectorEl.closest(".node-item");
      if (!nodeEl) return;
      const nodeId = nodeEl.dataset.id;
      const handle = connectorEl.dataset.handle;
      const startPos = getConnectorAbsolutePosition(nodeId, handle);
      currentAction = {
        type: "connecting",
        startNodeId: nodeId,
        startHandle: handle,
        startPos: startPos,
        tempLine: null,
        snapped: null
      };
      const tempLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
      tempLine.setAttribute("x1", startPos.x);
      tempLine.setAttribute("y1", startPos.y);
      tempLine.setAttribute("x2", startPos.x);
      tempLine.setAttribute("y2", startPos.y);
      tempLine.setAttribute("stroke", "#555");
      tempLine.setAttribute("stroke-dasharray", "5,5");
      tempLine.setAttribute("stroke-width", "2");
      tempLine.setAttribute("pointer-events", "none");
      currentAction.tempLine = tempLine;
      svgLayer.appendChild(tempLine);
      window.addEventListener("mousemove", onConnectionMouseMove);
      window.addEventListener("mouseup", onConnectionMouseUp);
    }
    function onConnectionMouseMove(e) {
      if (!currentAction || currentAction.type !== "connecting") return;
      const boardRect = boardContainer.getBoundingClientRect();
      const mouseX = (e.clientX - boardRect.left + boardContainer.scrollLeft) / trackingState.zoom;
      const mouseY = (e.clientY - boardRect.top + boardContainer.scrollTop) / trackingState.zoom;
      let snapped = null;
      document.querySelectorAll(".node-item").forEach((nodeEl) => {
        const id = nodeEl.dataset.id;
        if (id === currentAction.startNodeId) return;
        nodeEl.querySelectorAll(".connector").forEach((connEl) => {
          const handle = connEl.dataset.handle;
          const pos = getConnectorAbsolutePosition(id, handle);
          const dx = pos.x - mouseX, dy = pos.y - mouseY;
          if (Math.hypot(dx, dy) < SNAP_THRESHOLD) {
            snapped = { nodeId: id, handle, pos, el: connEl };
          }
          connEl.classList.remove("hovered");
        });
      });
      if (snapped) {
        currentAction.tempLine.setAttribute("x2", snapped.pos.x);
        currentAction.tempLine.setAttribute("y2", snapped.pos.y);
        snapped.el.classList.add("hovered");
        currentAction.snapped = snapped;
      } else {
        currentAction.tempLine.setAttribute("x2", mouseX);
        currentAction.tempLine.setAttribute("y2", mouseY);
        currentAction.snapped = null;
      }
    }
    function onConnectionMouseUp() {
      if (!currentAction || currentAction.type !== "connecting") return;
      if (currentAction.tempLine?.parentNode) {
        svgLayer.removeChild(currentAction.tempLine);
      }
      document.querySelectorAll(".connector.hovered").forEach((conn) => conn.classList.remove("hovered"));
      if (currentAction.snapped) {
        const alreadyExists = trackingState.trackingData.connections.some((conn) =>
          conn.from.nodeId === currentAction.startNodeId &&
          conn.from.handle === currentAction.startHandle &&
          conn.to.nodeId === currentAction.snapped.nodeId &&
          conn.to.handle === currentAction.snapped.handle
        );
        if (!alreadyExists) {
          trackingState.trackingData.connections.push({
            id: generateId("conn"),
            from: { nodeId: currentAction.startNodeId, handle: currentAction.startHandle },
            to: { nodeId: currentAction.snapped.nodeId, handle: currentAction.snapped.handle }
          });
        }
        redrawConnections();
        saveToLocalStorage();
      }
      window.removeEventListener("mousemove", onConnectionMouseMove);
      window.removeEventListener("mouseup", onConnectionMouseUp);
      currentAction = null;
      endInteraction();
    }
    function getConnectorAbsolutePosition(nodeId, handle) {
      const nodeEl = document.querySelector(`.node-item[data-id="${nodeId}"]`);
      if (!nodeEl) return { x: 0, y: 0 };
      const left = parseFloat(nodeEl.style.left) || 0;
      const top = parseFloat(nodeEl.style.top) || 0;
      const w = parseFloat(nodeEl.style.width) || nodeEl.offsetWidth;
      const h = parseFloat(nodeEl.style.height) || nodeEl.offsetHeight;
      switch (handle) {
        case "top":
          return { x: left + w / 2, y: top };
        case "bottom":
          return { x: left + w / 2, y: top + h };
        case "left":
          return { x: left, y: top + h / 2 };
        case "right":
          return { x: left + w, y: top + h / 2 };
        default:
          return { x: left, y: top };
      }
    }
    let isBoardPanning = false, panStartX = 0, panStartY = 0;
    let initialScrollLeft = 0, initialScrollTop = 0;
    boardContainer.addEventListener("mousedown", (e) => {
      if (e.target.id === "board" || e.target === boardContainer) {
        isBoardPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        initialScrollLeft = boardContainer.scrollLeft;
        initialScrollTop = boardContainer.scrollTop;
        boardContainer.classList.add("panning");
        e.preventDefault();
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (isBoardPanning) {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        boardContainer.scrollLeft = initialScrollLeft - dx;
        boardContainer.scrollTop = initialScrollTop - dy;
      }
    });
    window.addEventListener("mouseup", () => {
      if (isBoardPanning) {
        isBoardPanning = false;
        boardContainer.classList.remove("panning");
      }
    });
    document.getElementById("reset-zoom").addEventListener("click", () => {
      pushUndo();
      const isAiActive = aiPanel.dataset.collapsed !== "true";
      const aiPanelRect = aiPanel.getBoundingClientRect();
      const availableWidth = isAiActive ? boardContainer.clientWidth - aiPanelRect.width : boardContainer.clientWidth;
      trackingState.zoom = 1;
      applyZoom();
      if (trackingState.trackingData.nodes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        trackingState.trackingData.nodes.forEach((node) => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x + node.width);
          maxY = Math.max(maxY, node.y + node.height);
        });
        const bbWidth = maxX - minX;
        const bbHeight = maxY - minY;
        const scaleX = (availableWidth * 0.9) / bbWidth;
        const scaleY = (boardContainer.clientHeight * 0.9) / bbHeight;
        const newZoom = Math.min(scaleX, scaleY, 1);
        trackingState.zoom = newZoom;
        applyZoom();
        const bbCenterX = (minX + maxX) / 2;
        const bbCenterY = (minY + maxY) / 2;
        boardContainer.scrollLeft = bbCenterX * trackingState.zoom - availableWidth / 2;
        boardContainer.scrollTop = bbCenterY * trackingState.zoom - boardContainer.clientHeight / 2;
      } else {
        const boardWidth = boardEl.offsetWidth;
        const boardHeight = boardEl.offsetHeight;
        boardContainer.scrollLeft = (boardWidth - boardContainer.clientWidth) / 2;
        boardContainer.scrollTop = (boardHeight - boardContainer.clientHeight) / 2;
      }
      saveToLocalStorage();
    });
    boardContainer.addEventListener("wheel", (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const boardRect = boardContainer.getBoundingClientRect();
        const mouseX = e.clientX - boardRect.left + boardContainer.scrollLeft;
        const mouseY = e.clientY - boardRect.top + boardContainer.scrollTop;
        const oldZoom = trackingState.zoom;
        const zoomDelta = 0.05;
        trackingState.zoom = e.deltaY < 0 ? Math.min(trackingState.zoom + zoomDelta, 4.0) : Math.max(trackingState.zoom - zoomDelta, 0.2);
        boardContainer.scrollLeft = (mouseX / oldZoom) * trackingState.zoom - (e.clientX - boardRect.left);
        boardContainer.scrollTop = (mouseY / oldZoom) * trackingState.zoom - (e.clientY - boardRect.top);
        applyZoom();
        saveToLocalStorage();
      }
    });
    function applyZoom() {
      boardEl.style.transform = `scale(${trackingState.zoom})`;
      svgLayer.style.transform = `scale(${trackingState.zoom})`;
      const cellSize = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--grid-cell-size")) / trackingState.zoom;
      boardEl.style.backgroundSize = `${cellSize}px ${cellSize}px`;
    }
    boardEl.addEventListener("click", clearSelection);
    async function textToSpeech(text) {
      const requestBody = { model: "tts-1", voice: "alloy", input: text };
      try {
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify(requestBody)
        });
        if (!response.ok) {
          console.error("HTTP error:", response.status);
          const errorDetails = await response.json();
          console.error("Error details:", errorDetails);
          throw new Error(`HTTP error: ${response.status}`);
        }
        const audioBlob = await response.blob();
        return URL.createObjectURL(audioBlob);
      } catch (error) {
        console.error("TTS error:", error);
        return null;
      }
    }
    aiAttachmentInput.addEventListener("change", (e) => {
      const newFiles = Array.from(e.target.files);
      aiAttachments = aiAttachments.concat(newFiles);
      updateAttachmentPreview();
      aiAttachmentInput.value = "";
      chatInputEl.focus();
    });
    function updateAttachmentPreview() {
      if (aiAttachments.length === 0) {
        attachmentPreviewEl.style.display = "none";
        attachmentPreviewEl.innerHTML = "";
      } else {
        attachmentPreviewEl.style.display = "block";
        attachmentPreviewEl.innerHTML = aiAttachments.map((file, index) =>
          `<div class="attachment-item" data-index="${index}">${file.name} <span class="remove-attachment">×</span></div>`
        ).join("");
        document.querySelectorAll(".remove-attachment").forEach((item) => {
          item.addEventListener("click", (e) => {
            const parent = e.target.closest(".attachment-item");
            const idx = parseInt(parent.getAttribute("data-index"));
            aiAttachments.splice(idx, 1);
            updateAttachmentPreview();
          });
        });
      }
    }
    chatInputEl.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.value.trim() === "" ? "1.2em" : this.scrollHeight + "px";
    });
    const TYPE_DELAY = 0;
    async function callOpenAIChatAPI(updateCallback) {
      const url = "https://api.openai.com/v1/chat/completions";
      let fullResponse = "";
      let tokenBuffer = [];
      async function processBuffer() {
        while (tokenBuffer.length > 0) {
          const token = tokenBuffer.shift();
          fullResponse += token;
          updateCallback(fullResponse + `<span class="caret"></span>`);
          await new Promise((resolve) => setTimeout(resolve, TYPE_DELAY));
        }
      }
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`
          },
          body: JSON.stringify({
            model: "chatgpt-4o-latest",
            messages: conversationHistory,
            stream: true
          })
        });
        if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          const chunkValue = decoder.decode(value);
          const lines = chunkValue.split("\n").filter((line) => line.trim() !== "");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.replace("data: ", "");
              if (dataStr === "[DONE]") {
                done = true;
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                const token = parsed.choices[0].delta.content || "";
                tokenBuffer.push(token);
              } catch (err) {
                console.error("Error parsing stream chunk:", err);
              }
            }
          }
          await processBuffer();
        }
        await processBuffer();
        conversationHistory.push({ role: "assistant", content: fullResponse });
        return fullResponse;
      } catch (error) {
        console.error("Error calling OpenAI API:", error);
        updateCallback("Sorry, I encountered an error while processing your request.");
        return "Sorry, I encountered an error while processing your request.";
      }
    }
    let processing = false;
    async function sendMessage() {
      if (processing) return;
      const originalText = chatInputEl.value.trim();
      if (!originalText && aiAttachments.length === 0) return;
      processing = true;
      sendBtn.disabled = true;
      let queryText = originalText;
      if (queryText.includes("@board")) {
        queryText = queryText.replace(/@board\b/g, "").trim();
        const boardData = JSON.stringify(trackingState.trackingData, null, 2);
        const boardFile = new File([boardData], "board_data.json", { type: "application/json" });
        aiAttachments.push(boardFile);
        updateAttachmentPreview();
      }
      let attachmentsData = "";
      let attachedFileNames = "";
      if (aiAttachments.length > 0) {
        try {
          attachmentsData = await getAttachmentsContent();
        } catch (err) {
          console.error("Error reading attachments:", err);
        }
        attachedFileNames = aiAttachments.map(file => file.name).join(", ");
      }
      let displayText = originalText.replace(/(@board\b)/g, '<span class="highlight">$1</span>');
      if (attachedFileNames) {
        displayText += `<div class="attached-files">Attached: ${attachedFileNames}</div>`;
      }
      addChatMessage("User", displayText);
      chatInputEl.value = "";
      chatInputEl.style.height = "1.2em";
      aiAttachments = [];
      aiAttachmentInput.value = "";
      updateAttachmentPreview();
      const queryForAPI = attachmentsData ? `${queryText}\n\nAttachments:\n${attachmentsData}` : queryText;
      conversationHistory.push({ role: "user", content: queryForAPI });
      const aiMsgEl = addChatMessage("AI", "&nbsp;");
      let assistantResponse = await callOpenAIChatAPI((updatedContent) => {
        aiMsgEl.innerHTML = updatedContent + `<span class="caret"></span>`;
        chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      });
      try {
        assistantResponse = assistantResponse.replace("```json", "").replace("```", "");
        const parsed = JSON.parse(assistantResponse);
        if (parsed.responseType === "chart") {
          processOtherGraph(parsed.responseValue);
          aiMsgEl.innerHTML = "←";
        } else if (parsed.responseType === "text") {
          aiMsgEl.innerHTML = parsed.responseValue;
          const audioUrl = await textToSpeech(parsed.responseValue);
          if (audioUrl) {
            const audioElement = document.createElement("audio");
            audioElement.src = audioUrl;
          }
        } else {
          aiMsgEl.innerHTML = assistantResponse;
          const audioUrl = await textToSpeech(assistantResponse);
          if (audioUrl) {
            const audioElement = document.createElement("audio");
            audioElement.src = audioUrl;
          }
        }
      } catch (e) {
        aiMsgEl.innerHTML = assistantResponse;
        const audioUrl = await textToSpeech(assistantResponse);
        if (audioUrl) {
          const audioElement = document.createElement("audio");
          audioElement.src = audioUrl;
        }
      }
      conversationHistory.push({ role: "assistant", content: assistantResponse });
      processing = false;
      sendBtn.disabled = false;
      chatInputEl.focus();
    }
    sendBtn.addEventListener("click", sendMessage);
    chatInputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    document.getElementById("media-btn").addEventListener("click", () => {
      aiAttachmentInput.click();
    });
    function addChatMessage(sender, text) {
      const msgEl = document.createElement("div");
      msgEl.classList.add("chat-message", sender.toLowerCase());
      msgEl.innerHTML = text;
      chatMessagesEl.appendChild(msgEl);
      chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
      return msgEl;
    }
    let isResizingPanel = false, startX = 0, startWidth = 0;
    resizer.addEventListener("mousedown", (e) => {
      e.preventDefault();
      isResizingPanel = true;
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--panel-width"));
      document.body.classList.add("dragging-panel");
      resizer.style.transition = "none";
      aiPanel.style.transition = "none";
      document.body.style.cursor = "col-resize";
      window.addEventListener("mousemove", onPanelResizeMouseMove);
      window.addEventListener("mouseup", onPanelResizeMouseUp);
    });
    function onPanelResizeMouseMove(e) {
      if (!isResizingPanel) return;
      const delta = startX - e.clientX;
      let newWidth = startWidth + delta;
      newWidth = Math.max(newWidth, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--min-panel-width")));
      newWidth = Math.min(newWidth, parseInt(getComputedStyle(document.documentElement).getPropertyValue("--max-panel-width")));
      document.documentElement.style.setProperty("--panel-width", newWidth + "px");
      aiPanel.style.width = newWidth + "px";
      document.documentElement.style.setProperty("--ai-panel-width", aiPanel.dataset.collapsed !== "true" ? newWidth + "px" : "0px");
    }
    function onPanelResizeMouseUp() {
      if (!isResizingPanel) return;
      isResizingPanel = false;
      document.body.classList.remove("dragging-panel");
      resizer.style.transition = "opacity 0.3s ease";
      aiPanel.style.transition = "width 0.3s ease";
      document.body.style.cursor = "default";
      window.removeEventListener("mousemove", onPanelResizeMouseMove);
      window.removeEventListener("mouseup", onPanelResizeMouseUp);
    }
    let aiPanelCollapsed = false;
    const toggleFlagEl = document.getElementById("ai-toggle-flag");
    toggleFlagEl.addEventListener("click", () => {
      if (!aiPanelCollapsed) {
        aiPanelCollapsed = true;
        aiPanel.dataset.collapsed = "true";
        aiPanel.style.transform = "translateX(100%)";
        document.documentElement.style.setProperty("--ai-panel-width", "0px");
      } else {
        aiPanelCollapsed = false;
        aiPanel.dataset.collapsed = "false";
        aiPanel.style.transform = "translateX(0)";
        document.documentElement.style.setProperty("--ai-panel-width", getComputedStyle(document.documentElement).getPropertyValue("--panel-width"));
      }
    });
    aiPanel.addEventListener("mousedown", clearSelection);
    function startInteraction() {
      if (!interactionOverlay) {
        interactionOverlay = document.createElement("div");
        interactionOverlay.id = "interactionOverlay";
        document.body.appendChild(interactionOverlay);
      }
    }
    function endInteraction() {
      if (interactionOverlay) {
        document.body.removeChild(interactionOverlay);
        interactionOverlay = null;
      }
    }
    function autoCenter() {
      const isAiActive = aiPanel.dataset.collapsed !== "true";
      const aiPanelRect = aiPanel.getBoundingClientRect();
      const availableWidth = isAiActive ? boardContainer.clientWidth - aiPanelRect.width : boardContainer.clientWidth;
      if (trackingState.trackingData.nodes.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        trackingState.trackingData.nodes.forEach((node) => {
          minX = Math.min(minX, node.x);
          minY = Math.min(minY, node.y);
          maxX = Math.max(maxX, node.x + node.width);
          maxY = Math.max(maxY, node.y + node.height);
        });
        const bbCenterX = (minX + maxX) / 2;
        const bbCenterY = (minY + maxY) / 2;
        boardContainer.scrollLeft = bbCenterX * trackingState.zoom - availableWidth / 2;
        boardContainer.scrollTop = bbCenterY * trackingState.zoom - boardContainer.clientHeight / 2;
      } else {
        const boardWidth = boardEl.offsetWidth;
        const boardHeight = boardEl.offsetHeight;
        boardContainer.scrollLeft = (boardWidth - boardContainer.clientWidth) / 2;
        boardContainer.scrollTop = (boardHeight - boardContainer.clientHeight) / 2;
      }
    }
    const themeToggleEl = document.getElementById("theme-toggle");
    let darkModeEnabled = localStorage.getItem("theme") === "dark";
    function applyTheme() {
      if (darkModeEnabled) {
        document.body.classList.add("dark-mode");
        themeToggleEl.textContent = "☀️";
      } else {
        document.body.classList.remove("dark-mode");
        themeToggleEl.textContent = "🌙";
      }
      localStorage.setItem("theme", darkModeEnabled ? "dark" : "light");
    }
    themeToggleEl.addEventListener("click", () => {
      darkModeEnabled = !darkModeEnabled;
      applyTheme();
    });
    function findSpawnOffset(newNodes) {
      let newMinX = Infinity, newMinY = Infinity, newMaxX = -Infinity, newMaxY = -Infinity;
      newNodes.forEach((n) => {
        newMinX = Math.min(newMinX, n.x);
        newMinY = Math.min(newMinY, n.y);
        newMaxX = Math.max(newMaxX, n.x + n.width);
        newMaxY = Math.max(newMaxY, n.y + n.height);
      });
      const existingBoxes = trackingState.trackingData.nodes.map((n) => ({
        minX: n.x,
        minY: n.y,
        maxX: n.x + n.width,
        maxY: n.y + n.height
      }));
      let candidateX = boardContainer.scrollLeft / trackingState.zoom + 20;
      let candidateY = boardContainer.scrollTop / trackingState.zoom + 20;
      const margin = 50;
      let maxAttempts = 1000;
      let offset;
      while (maxAttempts-- > 0) {
        offset = { offsetX: candidateX - newMinX, offsetY: candidateY - newMinY };
        const newBox = {
          minX: newMinX + offset.offsetX,
          minY: newMinY + offset.offsetY,
          maxX: newMaxX + offset.offsetX,
          maxY: newMaxY + offset.offsetY
        };
        let collision = existingBoxes.some((box) => {
          return !(
            newBox.maxX + 10 < box.minX ||
            newBox.minX - 10 > box.maxX ||
            newBox.maxY + 10 < box.minY ||
            newBox.minY - 10 > box.maxY
          );
        });
        if (!collision) break;
        candidateX += margin;
        if (candidateX > boardContainer.scrollLeft / trackingState.zoom + boardContainer.clientWidth / trackingState.zoom - (newMaxX - newMinX)) {
          candidateX = boardContainer.scrollLeft / trackingState.zoom + 20;
          candidateY += margin;
        }
      }
      return offset;
    }
    function init() {
      loadFromLocalStorage();
      applyTheme();
      applyZoom();
      renderNodes();
      chatMessages = [];
      chatMessagesEl.innerHTML = "";
      autoCenter();
      document.getElementById("reset-zoom").click();
    }
    init();

    // ================================
    // Speech Recognition (Microphone)
    // ================================
    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      let silenceTimer = null;
      let isListening = false;

      recognition.addEventListener("result", (event) => {
        let transcript = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        chatInputEl.value = transcript;
        chatInputEl.dispatchEvent(new Event("input", { bubbles: true }));
        if (silenceTimer) clearTimeout(silenceTimer);
        silenceTimer = setTimeout(() => {
          recognition.stop();
          sendMessage();
        }, 2000);
      });

      recognition.addEventListener("error", (event) => {
        console.error("Speech recognition error:", event.error);
      });

      recognition.addEventListener("end", () => {
        if (silenceTimer) {
          clearTimeout(silenceTimer);
          silenceTimer = null;
        }
        isListening = false;
      });

      document.getElementById("mic-btn").addEventListener("click", () => {
        if (isListening) {
          recognition.stop();
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
          isListening = false;
        } else {
          chatInputEl.value = "";
          recognition.start();
          isListening = true;
        }
      });
    } else {
      console.warn("Speech recognition not supported in this browser.");
    }

    async function getAttachmentsContent() {
      return Promise.all(
        aiAttachments.map((file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(`File: ${file.name}\nContent: ${reader.result}`);
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
          });
        })
      ).then((results) => results.join("\n\n"));
    }
  }, []);

  return (
    <>
      <Head>
        <title>User Query AI</title>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Theme Toggle */}
      <div id="theme-toggle" title="Toggle Dark Mode">🌙</div>

      {/* Main Board Container */}
      <div id="board-container">
        <div id="board"></div>
        <svg id="connection-layer">
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#555" />
            </marker>
            <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#0066cc" />
            </marker>
          </defs>
        </svg>
      </div>

      {/* Bottom Toolbar */}
      <div id="toolbar">
        <button id="delete-selected" title="Delete">x</button>
        <button id="undo" title="Undo">↺</button>
        <button id="redo" title="Redo">↻</button>
        <button id="reset-zoom" title="Reset Zoom & Center">Reset</button>
      </div>

      {/* AI Panel */}
      <div id="ai-panel" data-collapsed="false">
        <div id="resizer"></div>
        <div id="ai-toggle-flag">[•_•]</div>
        <div id="ai-header">User Query AI</div>
        <div id="chat-messages"></div>
        <div id="chat-input-wrapper">
          <div id="attachment-preview"></div>
          <div id="chat-input-container">
            <button id="media-btn">+</button>
            <textarea id="chat-input" placeholder="Ask something..." rows="1"></textarea>
            <button id="mic-btn">🎤</button>
            <button id="send-btn">↑</button>
          </div>
          <div id="chat-disclaimer">
            An AI can make mistakes. Check important info.
            <br />
            <small>Note: The audio you hear is generated by AI.</small>
          </div>
        </div>
      </div>

      {/* Hidden Attachment Input */}
      <input type="file" id="ai-attachment-input" accept=".txt,.json" style={{ display: "none" }} multiple />
    </>
  );
}
