const Flowchart = require('../models/Flowchart');
const crypto = require('crypto');

const getUserId = (req) => req.user?._id || req.user?.id || req.user?.userId;

const generateUUID = () => {
    try {
        if (crypto && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
    } catch (e) { /* fallback */ }
    return 'ver_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
};

// Text parsing engine for auto-generating flowcharts from text steps
const parseStepsToFlowchart = (text) => {
    if (!text || typeof text !== 'string') {
        return { nodes: [], edges: [] };
    }

    const lines = text
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0);

    if (lines.length === 0) {
        return { nodes: [], edges: [] };
    }

    const nodes = [];
    const edges = [];

    // Add Start Node
    const startId = 'node_start';
    nodes.push({
        id: startId,
        type: 'start',
        label: 'Start Process',
        x: 500,
        y: 40,
        width: 150,
        height: 60,
        style: { fill: '#10b981', color: '#ffffff' },
        data: { description: 'Process start point' }
    });

    let currentY = 140;
    let prevNodeId = startId;
    let nodeCounter = 1;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lower = line.toLowerCase();

        // Check for decision / condition keywords
        const isDecision = lower.startsWith('if ') || 
                           lower.includes('?') || 
                           lower.startsWith('check ') || 
                           lower.startsWith('verify ') || 
                           lower.includes('condition');

        if (isDecision) {
            const decisionId = `node_${nodeCounter++}`;
            const cleanLabel = line.replace(/^(if|check|verify)\s+/i, '').replace(/\?$/, '');

            nodes.push({
                id: decisionId,
                type: 'decision',
                label: cleanLabel.length > 30 ? cleanLabel.substring(0, 30) + '...' : cleanLabel,
                x: 500,
                y: currentY,
                width: 170,
                height: 100,
                style: { fill: '#f59e0b', color: '#ffffff' },
                data: { description: line, notes: 'Decision diamond node' }
            });

            // Connect previous node to decision
            edges.push({
                id: `edge_${prevNodeId}_to_${decisionId}`,
                source: prevNodeId,
                target: decisionId,
                label: ''
            });

            // Check if next lines are Else / Yes / No branches
            let yesStep = null;
            let noStep = null;

            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                if (nextLine.toLowerCase().startsWith('else')) {
                    noStep = nextLine.replace(/^else\s*:?/i, '').trim();
                    i++;
                } else if (nextLine.toLowerCase().startsWith('then')) {
                    yesStep = nextLine.replace(/^then\s*:?/i, '').trim();
                    i++;
                } else {
                    yesStep = nextLine;
                    i++;
                }
            }

            if (i + 1 < lines.length && lines[i + 1].toLowerCase().startsWith('else')) {
                noStep = lines[i + 1].replace(/^else\s*:?/i, '').trim();
                i++;
            }

            // Yes Branch Node
            if (yesStep) {
                const yesNodeId = `node_${nodeCounter++}`;
                nodes.push({
                    id: yesNodeId,
                    type: 'process',
                    label: yesStep.length > 25 ? yesStep.substring(0, 25) + '...' : yesStep,
                    x: 300,
                    y: currentY + 140,
                    width: 170,
                    height: 60,
                    style: { fill: '#3b82f6', color: '#ffffff' },
                    data: { description: yesStep }
                });

                edges.push({
                    id: `edge_${decisionId}_yes_${yesNodeId}`,
                    source: decisionId,
                    target: yesNodeId,
                    label: 'Yes / True'
                });

                prevNodeId = yesNodeId;
            }

            // No Branch Node
            if (noStep) {
                const noNodeId = `node_${nodeCounter++}`;
                nodes.push({
                    id: noNodeId,
                    type: 'process',
                    label: noStep.length > 25 ? noStep.substring(0, 25) + '...' : noStep,
                    x: 700,
                    y: currentY + 140,
                    width: 170,
                    height: 60,
                    style: { fill: '#ef4444', color: '#ffffff' },
                    data: { description: noStep }
                });

                edges.push({
                    id: `edge_${decisionId}_no_${noNodeId}`,
                    source: decisionId,
                    target: noNodeId,
                    label: 'No / False'
                });

                // Create a join node to merge paths
                const mergeId = `node_${nodeCounter++}`;
                currentY += 260;

                nodes.push({
                    id: mergeId,
                    type: 'process',
                    label: 'Merge Branch',
                    x: 500,
                    y: currentY,
                    width: 150,
                    height: 50,
                    style: { fill: '#6b7280', color: '#ffffff' },
                    data: { description: 'Flow merge point' }
                });

                if (yesStep) {
                    edges.push({
                        id: `edge_yes_merge_${mergeId}`,
                        source: prevNodeId,
                        target: mergeId,
                        label: ''
                    });
                }

                edges.push({
                    id: `edge_no_merge_${mergeId}`,
                    source: noNodeId,
                    target: mergeId,
                    label: ''
                });

                prevNodeId = mergeId;
            } else {
                currentY += 140;
            }
        } else {
            // Standard Process Node
            const isIO = lower.includes('input') || lower.includes('output') || lower.includes('read') || lower.includes('print');
            const isDB = lower.includes('database') || lower.includes('store') || lower.includes('save db');
            const isDoc = lower.includes('document') || lower.includes('report') || lower.includes('file');

            let nodeType = 'process';
            let fillColor = '#3b82f6';

            if (isIO) {
                nodeType = 'input_output';
                fillColor = '#8b5cf6';
            } else if (isDB) {
                nodeType = 'database';
                fillColor = '#ec4899';
            } else if (isDoc) {
                nodeType = 'document';
                fillColor = '#06b6d4';
            }

            const nodeId = `node_${nodeCounter++}`;
            nodes.push({
                id: nodeId,
                type: nodeType,
                label: line.length > 30 ? line.substring(0, 30) + '...' : line,
                x: 500,
                y: currentY,
                width: 170,
                height: 60,
                style: { fill: fillColor, color: '#ffffff' },
                data: { description: line }
            });

            edges.push({
                id: `edge_${prevNodeId}_to_${nodeId}`,
                source: prevNodeId,
                target: nodeId,
                label: ''
            });

            prevNodeId = nodeId;
            currentY += 110;
        }
    }

    // Add End Node
    const endId = 'node_end';
    nodes.push({
        id: endId,
        type: 'end',
        label: 'End Process',
        x: 500,
        y: currentY + 20,
        width: 150,
        height: 60,
        style: { fill: '#ef4444', color: '#ffffff' },
        data: { description: 'Process end point' }
    });

    edges.push({
        id: `edge_${prevNodeId}_to_${endId}`,
        source: prevNodeId,
        target: endId,
        label: ''
    });

    return { nodes, edges };
};

// GET /api/flowcharts
exports.getAll = async (req, res) => {
    try {
        const userId = getUserId(req);
        const companyId = req.user?.companyId;
        const { status, search } = req.query;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        const query = { userId, isDeleted: false };
        if (companyId) query.companyId = companyId;
        if (status) query.status = status;
        if (search) {
            query.title = { $regex: search.trim(), $options: 'i' };
        }

        const flowcharts = await Flowchart.find(query)
            .sort({ updatedAt: -1 })
            .select('-versions.nodes -versions.edges')
            .lean();

        res.json({ success: true, data: flowcharts });
    } catch (error) {
        console.error('Error fetching flowcharts:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch flowcharts', error: error.message });
    }
};

// GET /api/flowcharts/:id
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        const flowchart = await Flowchart.findOne({ _id: id, userId, isDeleted: false });
        if (!flowchart) {
            return res.status(404).json({ success: false, message: 'Flowchart not found' });
        }

        flowchart.lastOpenedAt = new Date();
        await flowchart.save();

        res.json({ success: true, data: flowchart });
    } catch (error) {
        console.error('Error fetching flowchart by ID:', error);
        res.status(500).json({ success: false, message: 'Failed to load flowchart', error: error.message });
    }
};

// POST /api/flowcharts
exports.create = async (req, res) => {
    try {
        const userId = getUserId(req);
        const companyId = req.user?.companyId;
        const { title, description, category, rawSteps, nodes, edges, status, thumbnail } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Flowchart title is required' });
        }

        let initialNodes = nodes || [];
        let initialEdges = edges || [];

        // If rawSteps provided but nodes are empty, generate automatically
        if ((!initialNodes || initialNodes.length === 0) && rawSteps && rawSteps.trim()) {
            const parsed = parseStepsToFlowchart(rawSteps);
            initialNodes = parsed.nodes;
            initialEdges = parsed.edges;
        }

        const initialVersion = {
            versionId: generateUUID(),
            versionNumber: 1,
            nodes: initialNodes,
            edges: initialEdges,
            rawSteps: rawSteps || '',
            createdAt: new Date(),
            createdBy: userId
        };

        const flowchart = new Flowchart({
            userId,
            ...(companyId && { companyId }),
            title: title.trim(),
            description: description?.trim() || '',
            category: category?.trim() || 'General',
            rawSteps: rawSteps || '',
            nodes: initialNodes,
            edges: initialEdges,
            status: status || 'Draft',
            thumbnail: thumbnail || '',
            lastOpenedAt: new Date(),
            lastEditedBy: userId,
            versions: [initialVersion]
        });

        await flowchart.save();
        res.status(201).json({ success: true, data: flowchart, message: 'Flowchart created successfully' });
    } catch (error) {
        console.error('Error creating flowchart:', error);
        res.status(500).json({ success: false, message: 'Failed to create flowchart', error: error.message });
    }
};

// PUT /api/flowcharts/:id
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);
        const { title, description, category, rawSteps, nodes, edges, status, thumbnail, createVersion } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        const flowchart = await Flowchart.findOne({ _id: id, userId, isDeleted: false });
        if (!flowchart) {
            return res.status(404).json({ success: false, message: 'Flowchart not found' });
        }

        if (title) flowchart.title = title.trim();
        if (description !== undefined) flowchart.description = description.trim();
        if (category) flowchart.category = category.trim();
        if (rawSteps !== undefined) flowchart.rawSteps = rawSteps;
        if (nodes) flowchart.nodes = nodes;
        if (edges) flowchart.edges = edges;
        if (status) flowchart.status = status;
        if (thumbnail !== undefined) flowchart.thumbnail = thumbnail;
        flowchart.lastEditedBy = userId;

        // Optionally create a new version snapshot
        if (createVersion) {
            const nextVersionNum = (flowchart.versions?.length || 0) + 1;
            flowchart.versions.push({
                versionId: generateUUID(),
                versionNumber: nextVersionNum,
                nodes: nodes || flowchart.nodes,
                edges: edges || flowchart.edges,
                rawSteps: rawSteps || flowchart.rawSteps,
                createdAt: new Date(),
                createdBy: userId
            });
        }

        await flowchart.save();
        res.json({ success: true, data: flowchart, message: 'Flowchart saved successfully' });
    } catch (error) {
        console.error('Error updating flowchart:', error);
        res.status(500).json({ success: false, message: 'Failed to save flowchart', error: error.message });
    }
};

// DELETE /api/flowcharts/:id
exports.delete = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        const flowchart = await Flowchart.findOneAndUpdate(
            { _id: id, userId, isDeleted: false },
            { isDeleted: true },
            { new: true }
        );

        if (!flowchart) {
            return res.status(404).json({ success: false, message: 'Flowchart not found' });
        }

        res.json({ success: true, message: 'Flowchart deleted successfully' });
    } catch (error) {
        console.error('Error deleting flowchart:', error);
        res.status(500).json({ success: false, message: 'Failed to delete flowchart', error: error.message });
    }
};

// POST /api/flowcharts/generate
exports.generate = async (req, res) => {
    try {
        const { text } = req.body;
        if (!text || !text.trim()) {
            return res.status(400).json({ success: false, message: 'Text input is required' });
        }

        const result = parseStepsToFlowchart(text);
        res.json({ success: true, data: result });
    } catch (error) {
        console.error('Error generating flowchart from text:', error);
        res.status(500).json({ success: false, message: 'Failed to generate flowchart', error: error.message });
    }
};

// POST /api/flowcharts/import
exports.importJson = async (req, res) => {
    try {
        const userId = getUserId(req);
        const companyId = req.user?.companyId;
        const { title, description, category, rawSteps, nodes, edges } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        if (!title || !nodes || !Array.isArray(nodes)) {
            return res.status(400).json({ success: false, message: 'Invalid flowchart JSON structure' });
        }

        const initialVersion = {
            versionId: generateUUID(),
            versionNumber: 1,
            nodes: nodes,
            edges: edges || [],
            rawSteps: rawSteps || '',
            createdAt: new Date(),
            createdBy: userId
        };

        const flowchart = new Flowchart({
            userId,
            ...(companyId && { companyId }),
            title: title.trim() + ' (Imported)',
            description: description || 'Imported flowchart',
            category: category || 'General',
            rawSteps: rawSteps || '',
            nodes: nodes,
            edges: edges || [],
            status: 'Draft',
            versions: [initialVersion]
        });

        await flowchart.save();
        res.status(201).json({ success: true, data: flowchart, message: 'Flowchart imported successfully' });
    } catch (error) {
        console.error('Error importing flowchart:', error);
        res.status(500).json({ success: false, message: 'Failed to import flowchart', error: error.message });
    }
};

// GET /api/flowcharts/:id/versions
exports.getVersions = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        const flowchart = await Flowchart.findOne({ _id: id, userId, isDeleted: false }).select('versions title').lean();
        if (!flowchart) {
            return res.status(404).json({ success: false, message: 'Flowchart not found' });
        }

        res.json({ success: true, data: flowchart.versions || [] });
    } catch (error) {
        console.error('Error fetching versions:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch flowchart versions', error: error.message });
    }
};

// POST /api/flowcharts/:id/restore/:versionId
exports.restoreVersion = async (req, res) => {
    try {
        const { id, versionId } = req.params;
        const userId = getUserId(req);

        if (!userId) {
            return res.status(401).json({ success: false, message: 'User ID missing in request session' });
        }

        const flowchart = await Flowchart.findOne({ _id: id, userId, isDeleted: false });
        if (!flowchart) {
            return res.status(404).json({ success: false, message: 'Flowchart not found' });
        }

        const version = flowchart.versions.find(v => v.versionId === versionId);
        if (!version) {
            return res.status(404).json({ success: false, message: 'Version snapshot not found' });
        }

        flowchart.nodes = version.nodes;
        flowchart.edges = version.edges;
        flowchart.rawSteps = version.rawSteps;
        flowchart.lastEditedBy = userId;

        await flowchart.save();
        res.json({ success: true, data: flowchart, message: `Restored to version ${version.versionNumber}` });
    } catch (error) {
        console.error('Error restoring version:', error);
        res.status(500).json({ success: false, message: 'Failed to restore version', error: error.message });
    }
};
