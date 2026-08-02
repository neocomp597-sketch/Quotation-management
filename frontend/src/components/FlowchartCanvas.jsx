import React, { useState, useRef, useEffect, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    MdAddCircle,
    MdSave,
    MdPictureAsPdf,
    MdFileUpload,
    MdHistory,
    MdZoomIn,
    MdZoomOut,
    MdCenterFocusWeak,
    MdDelete,
    MdEdit,
    MdCheckCircle,
    MdSync,
    MdAutoGraph,
    MdColorLens,
    MdLink,
    MdDescription,
    MdClose,
    MdPalette,
    MdLightbulb
} from 'react-icons/md';
import { flowchartService } from '../services/api';
import { FLOWCHART_TEMPLATES } from '../constants/FlowchartTemplates';
import Modal from './Modal';
import { toast } from 'react-toastify';

const NODE_TYPES = [
    { type: 'start', label: 'Start', color: '#10b981', shape: 'pill' },
    { type: 'process', label: 'Process Step', color: '#3b82f6', shape: 'rect' },
    { type: 'decision', label: 'Decision (If/Else)', color: '#f59e0b', shape: 'diamond' },
    { type: 'input_output', label: 'Input / Output', color: '#8b5cf6', shape: 'parallelogram' },
    { type: 'database', label: 'Database', color: '#ec4899', shape: 'cylinder' },
    { type: 'document', label: 'Document / Report', color: '#06b6d4', shape: 'document' },
    { type: 'delay', label: 'Delay / Wait', color: '#f97316', shape: 'delay' },
    { type: 'end', label: 'End', color: '#ef4444', shape: 'pill' }
];

const FlowchartCanvas = ({
    flowchartData,
    onSave,
    onAutoSave,
    readOnly = false
}) => {
    const [title, setTitle] = useState(flowchartData?.title || 'Untitled Flowchart');
    const [description, setDescription] = useState(flowchartData?.description || '');
    const [nodes, setNodes] = useState(flowchartData?.nodes || []);
    const [edges, setEdges] = useState(flowchartData?.edges || []);
    const [rawSteps, setRawSteps] = useState(flowchartData?.rawSteps || '');
    
    // Zoom and pan canvas state
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });

    // Dragging node state
    const [draggingNodeId, setDraggingNodeId] = useState(null);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    // Connecting nodes state
    const [connectSourceId, setConnectSourceId] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);

    // Inspector selected items
    const [selectedNode, setSelectedNode] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [targetConnectNodeId, setTargetConnectNodeId] = useState('');

    // UI Drawers & Modals
    const [showVersionsDrawer, setShowVersionsDrawer] = useState(false);
    const [showCanvasTemplatesModal, setShowCanvasTemplatesModal] = useState(false);
    const [versionsList, setVersionsList] = useState([]);
    const [versionsLoading, setVersionsLoading] = useState(false);

    // Auto save status
    const [saveStatus, setSaveStatus] = useState('saved'); // 'saved', 'unsaved', 'saving'
    const autoSaveTimerRef = useRef(null);

    const handleFitView = useCallback((currentNodes = nodes) => {
        const activeNodes = currentNodes?.length ? currentNodes : nodes;
        if (!activeNodes || activeNodes.length === 0) {
            setPan({ x: 100, y: 50 });
            setZoom(1);
            return;
        }
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        activeNodes.forEach(n => {
            minX = Math.min(minX, n.x);
            maxX = Math.max(maxX, n.x + (n.width || 160));
            minY = Math.min(minY, n.y);
            maxY = Math.max(maxY, n.y + (n.height || 60));
        });

        const canvasWidth = 900;
        const canvasHeight = 600;
        const diagramWidth = maxX - minX || 1;
        const diagramHeight = maxY - minY || 1;

        const scaleX = (canvasWidth - 100) / diagramWidth;
        const scaleY = (canvasHeight - 100) / diagramHeight;
        const idealZoom = Math.min(1.0, Math.max(0.45, Math.min(scaleX, scaleY)));

        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;

        const panX = (canvasWidth / 2) - (centerX * idealZoom);
        const panY = (canvasHeight / 2) - (centerY * idealZoom);

        setZoom(Number(idealZoom.toFixed(2)));
        setPan({ x: Math.round(panX), y: Math.round(panY) });
    }, [nodes]);

    useEffect(() => {
        if (flowchartData) {
            setTitle(flowchartData.title || 'Untitled Flowchart');
            setDescription(flowchartData.description || '');
            setNodes(flowchartData.nodes || []);
            setEdges(flowchartData.edges || []);
            setRawSteps(flowchartData.rawSteps || '');
            if (flowchartData.nodes?.length) {
                handleFitView(flowchartData.nodes);
            }
        }
    }, [flowchartData]);

    // Mark unsaved on modifications
    const triggerChange = useCallback((newNodes, newEdges) => {
        setSaveStatus('unsaved');
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        
        autoSaveTimerRef.current = setTimeout(() => {
            if (onAutoSave) {
                setSaveStatus('saving');
                onAutoSave({
                    title,
                    description,
                    nodes: newNodes || nodes,
                    edges: newEdges || edges,
                    rawSteps
                }).then(() => setSaveStatus('saved')).catch(() => setSaveStatus('unsaved'));
            }
        }, 10000); // 10s debounced auto save
    }, [title, description, nodes, edges, rawSteps, onAutoSave]);

    // Helper to connect two nodes
    const connectTwoNodes = (sourceId, targetId, customLabel = '') => {
        if (!sourceId || !targetId || sourceId === targetId) return;
        const exists = edges.some(e => e.source === sourceId && e.target === targetId);
        if (exists) {
            toast.info('Connector line already exists between these nodes');
            return;
        }
        const sourceNode = nodes.find(n => n.id === sourceId);
        const defaultLabel = customLabel || (sourceNode?.type === 'decision' ? 'If Yes' : '');
        const newEdge = {
            id: `edge_${sourceId}_to_${targetId}_${Date.now()}`,
            source: sourceId,
            target: targetId,
            label: defaultLabel
        };
        const nextEdges = [...edges, newEdge];
        setEdges(nextEdges);
        triggerChange(nodes, nextEdges);
        toast.success('Nodes connected successfully!');
    };

    // Handle node drag start
    const handleNodeMouseDown = (e, node) => {
        if (readOnly || isConnecting) return;
        e.stopPropagation();
        setDraggingNodeId(node.id);
        setSelectedNode(node);
        setSelectedEdge(null);

        const svgRect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
        const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
        const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;

        setDragOffset({
            x: mouseX - node.x,
            y: mouseY - node.y
        });
    };

    // Handle Canvas mouse move for node drag & panning
    const handleCanvasMouseMove = (e) => {
        if (draggingNodeId) {
            const svgRect = e.currentTarget.getBoundingClientRect();
            const mouseX = (e.clientX - svgRect.left - pan.x) / zoom;
            const mouseY = (e.clientY - svgRect.top - pan.y) / zoom;

            const nextNodes = nodes.map(n => {
                if (n.id === draggingNodeId) {
                    return {
                        ...n,
                        x: Math.round(mouseX - dragOffset.x),
                        y: Math.round(mouseY - dragOffset.y)
                    };
                }
                return n;
            });
            setNodes(nextNodes);
            triggerChange(nextNodes, edges);
        } else if (isPanning) {
            setPan({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }
    };

    // Handle Canvas mouse up
    const handleCanvasMouseUp = () => {
        if (draggingNodeId) {
            setDraggingNodeId(null);
        }
        if (isPanning) {
            setIsPanning(false);
        }
    };

    // Add new node to canvas
    const handleAddNode = (typeObj) => {
        const newNodeId = `node_${Date.now()}`;
        const newNode = {
            id: newNodeId,
            type: typeObj.type,
            label: `New ${typeObj.label}`,
            x: 250 + (nodes.length * 20) % 200,
            y: 150 + (nodes.length * 20) % 200,
            width: typeObj.type === 'decision' ? 160 : 160,
            height: typeObj.type === 'decision' ? 90 : 60,
            style: { fill: typeObj.color, color: '#ffffff' },
            data: { description: '', notes: '', priority: 'Medium', hyperlink: '' }
        };

        const nextNodes = [...nodes, newNode];
        setNodes(nextNodes);
        setSelectedNode(newNode);
        triggerChange(nextNodes, edges);
    };

    // Node connection logic when clicking node or socket
    const handleNodeClickForConnect = (e, node) => {
        if (readOnly) return;
        e.stopPropagation();
        if (isConnecting) {
            if (connectSourceId && connectSourceId !== node.id) {
                connectTwoNodes(connectSourceId, node.id);
                setIsConnecting(false);
                setConnectSourceId(null);
            } else {
                setConnectSourceId(node.id);
                toast.info(`Source "${node.label}" selected. Click target node to draw arrow.`);
            }
        } else {
            setSelectedNode(node);
        }
    };

    const startConnector = (e, node) => {
        e.stopPropagation();
        setIsConnecting(true);
        setConnectSourceId(node.id);
        toast.info(`Source "${node.label}" selected. Click target node to draw arrow.`);
    };

    // Delete node
    const handleDeleteSelectedNode = () => {
        if (!selectedNode) return;
        const nextNodes = nodes.filter(n => n.id !== selectedNode.id);
        const nextEdges = edges.filter(e => e.source !== selectedNode.id && e.target !== selectedNode.id);
        setNodes(nextNodes);
        setEdges(nextEdges);
        setSelectedNode(null);
        triggerChange(nextNodes, nextEdges);
        toast.info('Node deleted');
    };

    // Delete edge
    const handleDeleteSelectedEdge = () => {
        if (!selectedEdge) return;
        const nextEdges = edges.filter(e => e.id !== selectedEdge.id);
        setEdges(nextEdges);
        setSelectedEdge(null);
        triggerChange(nodes, nextEdges);
        toast.info('Connector deleted');
    };

    // Render node SVG shapes based on type
    const renderNodeShape = (node) => {
        const { width, height, type, style } = node;
        const fill = style?.fill || '#3b82f6';
        const isSelected = selectedNode?.id === node.id;
        const isConnectSource = connectSourceId === node.id;
        const strokeColor = isConnectSource ? '#f59e0b' : isSelected ? '#10b981' : '#ffffff';
        const strokeWidth = isConnectSource || isSelected ? 3 : 1.5;

        switch (type) {
            case 'start':
            case 'end':
                return (
                    <rect
                        width={width}
                        height={height}
                        rx={height / 2}
                        ry={height / 2}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        className="shadow-md transition-colors"
                    />
                );
            case 'decision':
                const hw = width / 2;
                const hh = height / 2;
                return (
                    <polygon
                        points={`${hw},0 ${width},${hh} ${hw},${height} 0,${hh}`}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        className="shadow-md transition-colors"
                    />
                );
            case 'input_output':
                const offset = 20;
                return (
                    <polygon
                        points={`${offset},0 ${width},0 ${width - offset},${height} 0,${height}`}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        className="shadow-md transition-colors"
                    />
                );
            case 'database':
                return (
                    <g>
                        <rect
                            width={width}
                            height={height - 10}
                            y={10}
                            rx={4}
                            fill={fill}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                        />
                        <ellipse
                            cx={width / 2}
                            cy={10}
                            rx={width / 2}
                            ry={10}
                            fill={fill}
                            stroke={strokeColor}
                            strokeWidth={strokeWidth}
                        />
                    </g>
                );
            default: // process
                return (
                    <rect
                        width={width}
                        height={height}
                        rx={10}
                        ry={10}
                        fill={fill}
                        stroke={strokeColor}
                        strokeWidth={strokeWidth}
                        className="shadow-md transition-colors"
                    />
                );
        }
    };

    // Calculate edge coordinates
    const getEdgeCoords = (edge) => {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);

        if (!sourceNode || !targetNode) return null;

        const x1 = sourceNode.x + sourceNode.width / 2;
        const y1 = sourceNode.y + sourceNode.height;
        const x2 = targetNode.x + targetNode.width / 2;
        const y2 = targetNode.y;

        const midY = (y1 + y2) / 2;
        const path = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

        return { path, midX: (x1 + x2) / 2, midY };
    };

    // Save handler
    const handleManualSave = () => {
        setSaveStatus('saving');
        onSave({
            title,
            description,
            nodes,
            edges,
            rawSteps,
            createVersion: true
        }).then(() => {
            setSaveStatus('saved');
            toast.success('Flowchart & Version Snapshot saved!');
        }).catch(() => setSaveStatus('unsaved'));
    };

    // Export as PDF Handler
    const handleExportPDF = async () => {
        const svgEl = document.getElementById('canvas-bg');
        if (!svgEl) {
            toast.error('Canvas not found');
            return;
        }

        toast.info('Generating PDF, please wait...');

        try {
            // Clone the SVG and prepare it for rendering
            const svgClone = svgEl.cloneNode(true);
            const svgRect = svgEl.getBoundingClientRect();

            // Set explicit dimensions on the clone
            svgClone.setAttribute('width', svgRect.width);
            svgClone.setAttribute('height', svgRect.height);
            svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            // Set a white background on the clone
            svgClone.style.backgroundColor = '#ffffff';

            // Create an offscreen container
            const container = document.createElement('div');
            container.style.position = 'fixed';
            container.style.left = '-99999px';
            container.style.top = '0';
            container.style.width = svgRect.width + 'px';
            container.style.height = svgRect.height + 'px';
            container.style.backgroundColor = '#ffffff';
            container.appendChild(svgClone);
            document.body.appendChild(container);

            // Use html2canvas to capture the SVG container
            const canvas = await html2canvas(container, {
                backgroundColor: '#ffffff',
                scale: 2,
                useCORS: true,
                logging: false
            });

            document.body.removeChild(container);

            const imgData = canvas.toDataURL('image/png');

            // Create PDF (landscape for flowcharts)
            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: 'a4'
            });

            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;

            // Add title header
            pdf.setFontSize(20);
            pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(30, 41, 59); // slate-800
            pdf.text(title || 'Flowchart', margin, margin + 5);

            // Add description if present
            let yOffset = margin + 12;
            if (description) {
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.setTextColor(100, 116, 139); // slate-500
                const descLines = pdf.splitTextToSize(description, pageWidth - margin * 2);
                pdf.text(descLines, margin, yOffset);
                yOffset += descLines.length * 5 + 3;
            }

            // Add metadata line
            pdf.setFontSize(8);
            pdf.setTextColor(148, 163, 184); // slate-400
            pdf.text(
                `Generated on ${new Date().toLocaleDateString()} • ${nodes.length} nodes • ${edges.length} connectors`,
                margin,
                yOffset
            );
            yOffset += 6;

            // Draw a separator line
            pdf.setDrawColor(226, 232, 240); // slate-200
            pdf.setLineWidth(0.3);
            pdf.line(margin, yOffset, pageWidth - margin, yOffset);
            yOffset += 4;

            // Calculate image dimensions to fit remaining page space
            const availableWidth = pageWidth - margin * 2;
            const availableHeight = pageHeight - yOffset - margin;

            const imgAspect = canvas.width / canvas.height;
            const areaAspect = availableWidth / availableHeight;

            let imgW, imgH;
            if (imgAspect > areaAspect) {
                imgW = availableWidth;
                imgH = availableWidth / imgAspect;
            } else {
                imgH = availableHeight;
                imgW = availableHeight * imgAspect;
            }

            // Center the image horizontally
            const imgX = margin + (availableWidth - imgW) / 2;

            pdf.addImage(imgData, 'PNG', imgX, yOffset, imgW, imgH);

            // Add footer
            pdf.setFontSize(7);
            pdf.setTextColor(180, 180, 180);
            pdf.text(
                'Process Flowchart Builder — Quotation Management System',
                pageWidth / 2,
                pageHeight - 5,
                { align: 'center' }
            );

            // Download the PDF
            pdf.save(`${title.replace(/\s+/g, '_')}_flowchart.pdf`);
            toast.success('PDF exported successfully!');
        } catch (err) {
            console.error('PDF export error:', err);
            toast.error('Failed to export PDF. Please try again.');
        }
    };

    // Load version list
    const fetchVersions = async () => {
        if (!flowchartData?._id) return;
        setVersionsLoading(true);
        try {
            const res = await flowchartService.getVersions(flowchartData._id);
            if (res.data) setVersionsList(res.data.data || []);
        } catch (err) {
            toast.error('Failed to load version history');
        } finally {
            setVersionsLoading(false);
        }
    };

    const handleRestoreVersion = async (versionId) => {
        if (!window.confirm('Restore canvas to this version snapshot?')) return;
        try {
            const res = await flowchartService.restoreVersion(flowchartData._id, versionId);
            if (res.data && res.data.data) {
                setNodes(res.data.data.nodes || []);
                setEdges(res.data.data.edges || []);
                setRawSteps(res.data.data.rawSteps || '');
                toast.success('Restored flowchart version!');
                setShowVersionsDrawer(false);
            }
        } catch (err) {
            toast.error('Failed to restore version');
        }
    };

    const handleLoadTemplateInCanvas = (tmpl) => {
        if (nodes.length > 0 && !window.confirm(`Replace current canvas with "${tmpl.title}" template?`)) {
            return;
        }
        setNodes(tmpl.nodes || []);
        setEdges(tmpl.edges || []);
        setRawSteps(tmpl.rawSteps || '');
        if (!title || title === 'Untitled Flowchart') setTitle(tmpl.title);
        setShowCanvasTemplatesModal(false);
        triggerChange(tmpl.nodes, tmpl.edges);
        handleFitView(tmpl.nodes);
        toast.success(`Loaded "${tmpl.title}" template onto canvas!`);
    };

    const handleCanvasWheel = (e) => {
        if (e.ctrlKey) {
            const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
            setZoom(z => Number(Math.min(2.0, Math.max(0.3, z + zoomDelta)).toFixed(2)));
        } else {
            setPan(prev => ({
                x: Math.round(prev.x - e.deltaX * 0.8),
                y: Math.round(prev.y - e.deltaY * 0.8)
            }));
        }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-3.5rem)] min-h-[750px] w-full bg-slate-50 dark:bg-slate-950 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden relative">
            {/* Top Canvas Toolbar */}
            <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 z-20">
                <div className="flex items-center gap-3">
                    <input
                        type="text"
                        value={title}
                        disabled={readOnly}
                        onChange={(e) => {
                            setTitle(e.target.value);
                            triggerChange();
                        }}
                        className="text-lg font-black text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-primary-500 focus:outline-none transition-all px-1 py-0.5"
                    />

                    {/* Auto-Save Badge */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {saveStatus === 'saved' && (
                            <>
                                <MdCheckCircle className="text-emerald-500" size={14} />
                                <span>Saved just now</span>
                            </>
                        )}
                        {saveStatus === 'saving' && (
                            <>
                                <MdSync className="text-primary-500 animate-spin" size={14} />
                                <span>Saving...</span>
                            </>
                        )}
                        {saveStatus === 'unsaved' && (
                            <>
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                <span>Unsaved changes</span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Draw Connector Button */}
                    {!readOnly && (
                        <button
                            onClick={() => {
                                if (isConnecting) {
                                    setIsConnecting(false);
                                    setConnectSourceId(null);
                                } else {
                                    setIsConnecting(true);
                                    toast.info('Click source node, then click target node to connect');
                                }
                            }}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 ${
                                isConnecting
                                    ? 'bg-amber-500 text-white animate-pulse shadow-md'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
                            }`}
                        >
                            <MdLink size={16} />
                            {isConnecting ? (connectSourceId ? 'Click Target Node...' : 'Select Source Node...') : 'Draw Connector'}
                        </button>
                    )}

                    {/* Load Templates Button */}
                    {!readOnly && (
                        <button
                            onClick={() => setShowCanvasTemplatesModal(true)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                        >
                            <MdLightbulb className="text-amber-500" size={16} /> Templates
                        </button>
                    )}

                    {/* Zoom Controls */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                        <button
                            onClick={() => setZoom(z => Math.max(0.4, z - 0.1))}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Zoom Out"
                        >
                            <MdZoomOut size={18} />
                        </button>
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200 px-2">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Zoom In"
                        >
                            <MdZoomIn size={18} />
                        </button>
                        <button
                            onClick={() => handleFitView()}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="Auto-Fit & Center View"
                        >
                            <MdCenterFocusWeak size={18} />
                        </button>
                    </div>

                    {/* Version History Button */}
                    {flowchartData?._id && (
                        <button
                            onClick={() => {
                                fetchVersions();
                                setShowVersionsDrawer(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                        >
                            <MdHistory size={16} /> History
                        </button>
                    )}

                    {/* Export PDF */}
                    <button
                        onClick={handleExportPDF}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center gap-1.5"
                    >
                        <MdPictureAsPdf size={16} /> Export PDF
                    </button>

                    {/* Save Button */}
                    {!readOnly && (
                        <button
                            onClick={handleManualSave}
                            className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-black text-xs shadow-lg shadow-primary-600/20 transition-all flex items-center gap-1.5"
                        >
                            <MdSave size={16} /> Save Diagram
                        </button>
                    )}
                </div>
            </div>

            {/* Canvas Body & Node Palette */}
            <div className="flex-1 relative overflow-hidden flex">
                {/* Node Palette Bar (Left Side) */}
                {!readOnly && (
                    <div className="w-48 bg-white/90 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 p-4 space-y-3 z-10 overflow-y-auto">
                        <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                            Add Shapes
                        </div>
                        <div className="space-y-2">
                            {NODE_TYPES.map(nt => (
                                <button
                                    key={nt.type}
                                    onClick={() => handleAddNode(nt)}
                                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-primary-500 dark:hover:border-primary-500 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 flex items-center gap-2.5 text-left transition-all group"
                                >
                                    <div
                                        className="w-4 h-4 rounded shadow-sm shrink-0"
                                        style={{ backgroundColor: nt.color }}
                                    />
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                                        {nt.label}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* SVG Visual Canvas Area */}
                <div
                    className="flex-1 h-full w-full relative cursor-grab active:cursor-grabbing overflow-hidden"
                    onWheel={handleCanvasWheel}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseDown={(e) => {
                        if (e.target.tagName === 'svg' || e.target.id === 'canvas-bg') {
                            setIsPanning(true);
                            setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
                            setSelectedNode(null);
                            setSelectedEdge(null);
                        }
                    }}
                >
                    <svg
                        id="canvas-bg"
                        className="w-full h-full"
                        style={{
                            backgroundImage: 'radial-gradient(circle at 1px 1px, #cbd5e1 1px, transparent 0)',
                            backgroundSize: '24px 24px'
                        }}
                    >
                        {/* SVG Arrow Marker Defs */}
                        <defs>
                            <marker
                                id="arrowhead"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
                            </marker>
                            <marker
                                id="arrowhead-selected"
                                markerWidth="10"
                                markerHeight="7"
                                refX="9"
                                refY="3.5"
                                orient="auto"
                            >
                                <polygon points="0 0, 10 3.5, 0 7" fill="#10b981" />
                            </marker>
                        </defs>

                        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                            {/* Render Connectors/Edges */}
                            {edges.map(edge => {
                                const coords = getEdgeCoords(edge);
                                if (!coords) return null;
                                const isSelected = selectedEdge?.id === edge.id;

                                return (
                                    <g key={edge.id} className="cursor-pointer group" onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEdge(edge);
                                        setSelectedNode(null);
                                    }}>
                                        <path
                                            d={coords.path}
                                            fill="none"
                                            stroke={isSelected ? '#10b981' : '#64748b'}
                                            strokeWidth={isSelected ? 3 : 2}
                                            markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"}
                                            className="transition-colors group-hover:stroke-primary-500"
                                        />
                                        {/* Edge Label Pill */}
                                        {edge.label && (
                                            <g transform={`translate(${coords.midX}, ${coords.midY})`}>
                                                <rect
                                                    x="-40"
                                                    y="-12"
                                                    width="80"
                                                    height="24"
                                                    rx="6"
                                                    fill="#ffffff"
                                                    stroke="#cbd5e1"
                                                    strokeWidth="1"
                                                />
                                                <text
                                                    x="0"
                                                    y="4"
                                                    textAnchor="middle"
                                                    fontSize="10"
                                                    fontWeight="bold"
                                                    fill="#334155"
                                                >
                                                    {edge.label}
                                                </text>
                                            </g>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Render Nodes */}
                            {nodes.map(node => (
                                <g
                                    key={node.id}
                                    transform={`translate(${node.x}, ${node.y})`}
                                    onMouseDown={(e) => handleNodeMouseDown(e, node)}
                                    onClick={(e) => handleNodeClickForConnect(e, node)}
                                    className="cursor-move select-none"
                                >
                                    {renderNodeShape(node)}

                                    {/* Node Label Text */}
                                    <text
                                        x={node.width / 2}
                                        y={node.height / 2 + 4}
                                        textAnchor="middle"
                                        fontSize="12"
                                        fontWeight="bold"
                                        fill={node.style?.color || '#ffffff'}
                                        className="pointer-events-none"
                                    >
                                        {node.label}
                                    </text>

                                    {/* 4-Directional Sockets (Top, Bottom, Left, Right) */}
                                    {!readOnly && (
                                        <>
                                            {/* Bottom Socket */}
                                            <circle
                                                cx={node.width / 2}
                                                cy={node.height}
                                                r="6"
                                                fill="#10b981"
                                                stroke="#ffffff"
                                                strokeWidth="2"
                                                className="hover:scale-125 cursor-crosshair transition-all"
                                                onClick={(e) => startConnector(e, node)}
                                                title="Click to draw connector from bottom"
                                            />
                                            {/* Top Socket */}
                                            <circle
                                                cx={node.width / 2}
                                                cy={0}
                                                r="6"
                                                fill="#10b981"
                                                stroke="#ffffff"
                                                strokeWidth="2"
                                                className="hover:scale-125 cursor-crosshair transition-all"
                                                onClick={(e) => startConnector(e, node)}
                                                title="Click to draw connector from top"
                                            />
                                            {/* Left Socket */}
                                            <circle
                                                cx={0}
                                                cy={node.height / 2}
                                                r="6"
                                                fill="#10b981"
                                                stroke="#ffffff"
                                                strokeWidth="2"
                                                className="hover:scale-125 cursor-crosshair transition-all"
                                                onClick={(e) => startConnector(e, node)}
                                                title="Click to draw connector from left"
                                            />
                                            {/* Right Socket */}
                                            <circle
                                                cx={node.width}
                                                cy={node.height / 2}
                                                r="6"
                                                fill="#10b981"
                                                stroke="#ffffff"
                                                strokeWidth="2"
                                                className="hover:scale-125 cursor-crosshair transition-all"
                                                onClick={(e) => startConnector(e, node)}
                                                title="Click to draw connector from right"
                                            />
                                        </>
                                    )}
                                </g>
                            ))}
                        </g>
                    </svg>

                    {/* Floating Navigation Tip Pill */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-500 shadow-lg pointer-events-none z-10">
                        Scroll mouse wheel / trackpad to move down • Click & drag canvas to pan
                    </div>
                </div>

                {/* Right Side Node/Edge Inspector Drawer */}
                {(selectedNode || selectedEdge) && !readOnly && (
                    <div className="w-80 bg-white/95 dark:bg-slate-900/95 border-l border-slate-200 dark:border-slate-800 p-5 space-y-5 z-10 overflow-y-auto animate-in slide-in-from-right-4 duration-200">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                                {selectedNode ? 'Edit Node Details' : 'Edit Connector'}
                            </h4>
                            <button
                                onClick={() => { setSelectedNode(null); setSelectedEdge(null); }}
                                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
                            >
                                <MdClose size={18} />
                            </button>
                        </div>

                        {selectedNode && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Node Title</label>
                                    <input
                                        type="text"
                                        value={selectedNode.label}
                                        onChange={(e) => {
                                            const updated = nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n);
                                            setNodes(updated);
                                            setSelectedNode({ ...selectedNode, label: e.target.value });
                                            triggerChange(updated, edges);
                                        }}
                                        className="w-full mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500"
                                    />
                                </div>

                                {/* Connect To Another Node Option */}
                                <div className="p-3 bg-primary-50/60 dark:bg-primary-950/40 rounded-2xl border border-primary-100 dark:border-primary-900 space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-primary-700 dark:text-primary-400 flex items-center gap-1">
                                        <MdLink size={14} /> Connect To Another Node
                                    </label>
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={targetConnectNodeId}
                                            onChange={(e) => setTargetConnectNodeId(e.target.value)}
                                            className="flex-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100"
                                        >
                                            <option value="">Select target node...</option>
                                            {nodes.filter(n => n.id !== selectedNode.id).map(n => (
                                                <option key={n.id} value={n.id}>
                                                    {n.label} ({n.type})
                                                </option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (targetConnectNodeId) {
                                                    connectTwoNodes(selectedNode.id, targetConnectNodeId);
                                                    setTargetConnectNodeId('');
                                                } else {
                                                    toast.error('Select a target node first');
                                                }
                                            }}
                                            className="px-3 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-xs shadow-md"
                                        >
                                            Connect
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fill Color</label>
                                    <div className="flex items-center gap-2 mt-1.5">
                                        {['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#64748b'].map(c => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => {
                                                    const updated = nodes.map(n => n.id === selectedNode.id ? { ...n, style: { ...n.style, fill: c } } : n);
                                                    setNodes(updated);
                                                    setSelectedNode({ ...selectedNode, style: { ...selectedNode.style, fill: c } });
                                                    triggerChange(updated, edges);
                                                }}
                                                className={`w-6 h-6 rounded-full border-2 ${selectedNode.style?.fill === c ? 'border-slate-900 dark:border-white scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description / Notes</label>
                                    <textarea
                                        rows={3}
                                        value={selectedNode.data?.description || ''}
                                        onChange={(e) => {
                                            const updated = nodes.map(n => n.id === selectedNode.id ? { ...n, data: { ...n.data, description: e.target.value } } : n);
                                            setNodes(updated);
                                            setSelectedNode({ ...selectedNode, data: { ...selectedNode.data, description: e.target.value } });
                                            triggerChange(updated, edges);
                                        }}
                                        placeholder="Add node notes or steps..."
                                        className="w-full mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100"
                                    />
                                </div>

                                <button
                                    onClick={handleDeleteSelectedNode}
                                    className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <MdDelete size={16} /> Delete Node
                                </button>
                            </div>
                        )}

                        {selectedEdge && (
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Condition / Label</label>
                                    <input
                                        type="text"
                                        value={selectedEdge.label || ''}
                                        onChange={(e) => {
                                            const updated = edges.map(eg => eg.id === selectedEdge.id ? { ...eg, label: e.target.value } : eg);
                                            setEdges(updated);
                                            setSelectedEdge({ ...selectedEdge, label: e.target.value });
                                            triggerChange(nodes, updated);
                                        }}
                                        placeholder="e.g. If Yes, If No, Approved..."
                                        className="w-full mt-1 p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-900 dark:text-slate-100"
                                    />
                                </div>

                                <button
                                    onClick={handleDeleteSelectedEdge}
                                    className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5"
                                >
                                    <MdDelete size={16} /> Delete Connector
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* In-Canvas Templates Selector Modal */}
            <Modal
                isOpen={showCanvasTemplatesModal}
                onClose={() => setShowCanvasTemplatesModal(false)}
                title="Load Process Template onto Canvas"
                maxWidth="max-w-5xl"
            >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[32rem] overflow-y-auto pr-1">
                    {FLOWCHART_TEMPLATES.map(tmpl => (
                        <div
                            key={tmpl.id}
                            onClick={() => handleLoadTemplateInCanvas(tmpl)}
                            className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer flex flex-col justify-between space-y-3 group shadow-sm hover:shadow-md"
                        >
                            <div className="space-y-2">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300">
                                    {tmpl.category}
                                </span>
                                <h4 className="font-black text-slate-900 dark:text-slate-100 text-sm group-hover:text-primary-600 transition-colors">
                                    {tmpl.title}
                                </h4>
                                <p className="text-xs text-slate-500 font-medium leading-relaxed">
                                    {tmpl.description}
                                </p>
                            </div>
                            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] font-bold text-slate-400">
                                <span>{tmpl.nodes?.length || 0} Nodes</span>
                                <span className="text-primary-600 font-black group-hover:underline">Load Template →</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

            {/* Version History Drawer Modal */}
            {showVersionsDrawer && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex justify-end animate-in fade-in duration-200">
                    <div className="w-80 bg-white dark:bg-slate-900 h-full p-6 space-y-6 overflow-y-auto border-l border-slate-200 dark:border-slate-800 shadow-2xl">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                            <h3 className="font-black text-slate-900 dark:text-slate-100 text-lg flex items-center gap-2">
                                <MdHistory className="text-primary-600" /> Version Snapshots
                            </h3>
                            <button onClick={() => setShowVersionsDrawer(false)} className="text-slate-400 hover:text-slate-600">
                                ✕
                            </button>
                        </div>

                        {versionsLoading ? (
                            <p className="text-xs text-slate-500 font-bold">Loading history...</p>
                        ) : versionsList.length === 0 ? (
                            <p className="text-xs text-slate-500 font-bold">No versions recorded yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {versionsList.map(v => (
                                    <div
                                        key={v.versionId}
                                        className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary-500 space-y-2 transition-all"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-slate-900 dark:text-slate-100">
                                                Version {v.versionNumber}
                                            </span>
                                            <span className="text-[10px] text-slate-400 font-bold">
                                                {new Date(v.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium">
                                            {v.nodes?.length || 0} nodes • {v.edges?.length || 0} connectors
                                        </p>
                                        <button
                                            onClick={() => handleRestoreVersion(v.versionId)}
                                            className="w-full py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-bold text-xs transition-colors"
                                        >
                                            Restore Snapshot
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FlowchartCanvas;
