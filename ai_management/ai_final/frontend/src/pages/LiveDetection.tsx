import { useState, useEffect } from 'react';
import { apiPost, API_URL } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';

interface Detection {
    class: string;
    confidence: number;
    model?: string;
}

interface ModelsInfo {
    available: string[];
    active: string;
    main_loaded: boolean;
}

type DetectionMode = 'truck' | 'sugar';

export default function LiveDetection() {
    const [isStreaming, setIsStreaming] = useState(false);
    const [cameraSource, setCameraSource] = useState('0');
    const [detections, setDetections] = useState<Detection[]>([]);
    const [loading, setLoading] = useState(false);
    const [models, setModels] = useState<ModelsInfo | null>(null);
    const [selectedModel, setSelectedModel] = useState<string>('');
    const [mode, setMode] = useState<DetectionMode>('truck');
    const [sugarCount, setSugarCount] = useState(0);
    const [isUploaded, setIsUploaded] = useState(false);
    const { addToast } = useToast();

    useEffect(() => {
        fetchModels();
    }, []);

    // Effect to handle mode switching model logic
    useEffect(() => {
        if (!models) return;

        if (mode === 'truck') {
            // Default to best_dec20 for trucks
            if (models.available.includes('best_dec20') && selectedModel !== 'best_dec20') {
                switchModel('best_dec20');
            }
        } else if (mode === 'sugar') {
            // Default to first sugar model if not already on one
            if (!selectedModel.includes('sugar') && models.available.some(m => m.includes('sugar'))) {
                const firstSugar = models.available.find(m => m.includes('sugar'));
                if (firstSugar) switchModel(firstSugar);
            }
        }
    }, [mode, models]); // Depend on mode and models loaded

    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (isStreaming) {
            interval = setInterval(fetchDetections, 1000);
        }
        return () => clearInterval(interval);
    }, [isStreaming]);

    async function fetchModels() {
        try {
            const response = await fetch(`${API_URL}/api/v1/models`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const data = await response.json();
            setModels(data);
            setSelectedModel(data.active);

            // Initial mode set based on active model
            if (data.active.includes('sugar')) {
                setMode('sugar');
            } else {
                setMode('truck');
            }
        } catch (err) {
            console.error('Failed to fetch models:', err);
        }
    }

    async function switchModel(modelName: string) {
        try {
            await apiPost('/api/v1/models/switch', { model: modelName });
            setSelectedModel(modelName);
            addToast(`Switched to ${modelName}`, 'success');
            // Don't re-fetch models here to avoid loops, just update local state
        } catch (err) {
            addToast('Failed to switch model', 'error');
        }
    }

    async function fetchDetections() {
        try {
            const response = await fetch(`${API_URL}/api/v1/camera/detections`, {
                headers: { 'ngrok-skip-browser-warning': 'true' }
            });
            const data = await response.json();
            setDetections(data);

            // Simple client-side counting visualization for demo
            // In a real app this would come from backend session stats
            if (mode === 'sugar') {
                const bagCount = data.filter((d: Detection) => d.class.toLowerCase().includes('bag')).length;
                if (bagCount > 0) {
                    setSugarCount(prev => prev + bagCount); // Just adding current frame count for visualization demo
                }
            }
        } catch (err) {
            console.error('Failed to fetch detections:', err);
        }
    }

    // Explicit reset for counter
    function resetCounter() {
        setSugarCount(0);
        apiPost('/api/v1/sugar-count/reset');
    }

    async function startCamera() {
        setLoading(true);
        try {
            await apiPost('/api/v1/camera/start', { source: cameraSource });
            setIsStreaming(true);
            addToast(isUploaded ? 'Processing video...' : 'Camera started', 'success');
        } catch (err) {
            addToast(err instanceof Error ? err.message : 'Failed to start camera', 'error');
        } finally {
            setLoading(false);
        }
    }

    async function stopCamera() {
        try {
            await apiPost('/api/v1/camera/stop');
            setIsStreaming(false);
            setDetections([]);
            addToast('Stopped', 'info');
        } catch (err) {
            console.error('Failed to stop camera:', err);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/v1/compression/upload`, {
                method: 'POST',
                headers: { 'ngrok-skip-browser-warning': 'true' },
                body: formData
            });
            const data = await res.json();
            if (data.job_id) {
                setCameraSource(`/content/uploads/${data.job_id}_input${file.name.substring(file.name.lastIndexOf('.'))}`);
                setIsUploaded(true);
                addToast(`Uploaded: ${file.name}`, 'success');
            }
        } catch (err) {
            addToast('Upload failed', 'error');
            setIsUploaded(false);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div>
            <PageHeader
                title="Live Detection"
                subtitle="Real-time AI-powered object detection"
            />

            {/* Mode Switcher */}
            <div className="card" style={{ marginBottom: 20, padding: 15 }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                    <h3 style={{ margin: 0, marginRight: 10 }}>Detection Mode:</h3>
                    <button
                        className={`btn ${mode === 'truck' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setMode('truck')}
                        style={{ minWidth: 150 }}
                    >
                        Truck Entry/Exit
                    </button>
                    <button
                        className={`btn ${mode === 'sugar' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setMode('sugar')}
                        style={{ minWidth: 150 }}
                    >
                        Sugar Bag Offloading
                    </button>
                </div>
            </div>

            {/* Specialized Stats Row */}
            <div className="grid grid-4" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                    <div className="stat-content">
                        <div className="stat-label">Status</div>
                        <div className="stat-value" style={{ fontSize: '1rem' }}>
                            {isStreaming ? 'Streaming' : 'Idle'}
                        </div>
                    </div>
                </div>

                {mode === 'sugar' ? (
                    <div className="stat-card" style={{ borderLeft: '4px solid var(--accent)' }}>
                        <div className="stat-content">
                            <div className="stat-label">Bags Offloaded</div>
                            <div className="stat-value" style={{ color: 'var(--accent)' }}>
                                {sugarCount}
                            </div>
                            <button
                                onClick={resetCounter}
                                style={{
                                    background: 'none', border: 'none', color: 'var(--text-secondary)',
                                    cursor: 'pointer', fontSize: '0.8rem', padding: 0, marginTop: 5
                                }}
                            >
                                Reset Count
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="stat-card">
                        <div className="stat-content">
                            <div className="stat-label">Live Detections</div>
                            <div className="stat-value">{detections.length}</div>
                        </div>
                    </div>
                )}

                <div className="stat-card">
                    <div className="stat-content">
                        <div className="stat-label">Active Model</div>
                        <div className="stat-value" style={{ fontSize: '0.9rem' }}>
                            {selectedModel ? selectedModel.replace('sugar_bag_', '') : 'None'}
                        </div>
                    </div>
                </div>

                {mode === 'truck' && (
                    <div className="stat-card">
                        <div className="stat-content">
                            <div className="stat-label">Entry/Exit Events</div>
                            <div className="stat-value">0</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <h3 className="card-title">
                        {mode === 'truck' ? 'Truck Monitoring Controls' : 'Sugar Bag Counting Controls'}
                    </h3>
                </div>
                <div className="grid grid-3">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Camera Source</label>
                        <input
                            type="text"
                            className="input"
                            value={cameraSource}
                            onChange={(e) => {
                                setCameraSource(e.target.value);
                                setIsUploaded(false); // Reset upload state on manual edit
                            }}
                            placeholder="0, RTSP URL, or file path"
                        />
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Detection Model</label>
                        <select
                            className="input"
                            value={selectedModel}
                            onChange={(e) => switchModel(e.target.value)}
                            disabled={mode === 'truck'} // Truck mode locked to best_dec20
                        >
                            {models?.available
                                .filter(m => mode === 'sugar' ? m.includes('sugar') : true)
                                .map(model => (
                                    <option key={model} value={model}>
                                        {model.replace('sugar_bag_', '').replace(/_/g, ' ')}
                                        {model === models.active && ' (Active)'}
                                    </option>
                                ))}
                        </select>
                        {mode === 'truck' && (
                            <div className="text-muted" style={{ fontSize: '0.8rem', marginTop: 5 }}>
                                Start model locked to best_dec20
                            </div>
                        )}
                    </div>

                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Actions</label>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {isStreaming ? (
                                <button className="btn btn-danger" onClick={stopCamera}>
                                    Stop Stream
                                </button>
                            ) : (
                                <button
                                    className={`btn ${isUploaded ? 'btn-primary' : 'btn-success'}`}
                                    onClick={startCamera}
                                    disabled={loading}
                                >
                                    {loading ? 'Starting...' : (isUploaded ? 'Start Detection' : 'Start Camera')}
                                </button>
                            )}
                            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
                                {isUploaded ? 'Upload New' : 'Upload Video'}
                                <input
                                    type="file"
                                    style={{ display: 'none' }}
                                    accept="video/*"
                                    onChange={handleFileUpload}
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            {/* Video + Detections Grid */}
            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">Video Feed</h3>
                        {isStreaming && (
                            <span className="badge badge-online">LIVE</span>
                        )}
                    </div>
                    <div className="video-container">
                        {isStreaming ? (
                            <VideoPlayer />
                        ) : (
                            <div className="video-placeholder">
                                <p>No camera connected</p>
                                <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                                    Click Start to begin streaming
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            {mode === 'sugar' ? 'Live Bag Tracking' : 'Live Detections'}
                        </h3>
                    </div>

                    {detections.length === 0 ? (
                        <div className="empty-state">
                            <p>No objects detected</p>
                            <p className="text-muted" style={{ fontSize: '0.8rem' }}>
                                Start streaming to see detections
                            </p>
                        </div>
                    ) : (
                        <div className="detection-list">
                            {detections.map((det, idx) => (
                                <div key={idx} className="detection-item">
                                    <div>
                                        <span style={{ fontWeight: 500 }}>{det.class}</span>
                                        {det.model && (
                                            <span className="text-muted" style={{ fontSize: '0.75rem', marginLeft: 8 }}>
                                                via {det.model}
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="confidence-bar">
                                            <div
                                                className="confidence-fill"
                                                style={{
                                                    width: `${det.confidence * 100}%`,
                                                    background: det.confidence > 0.7 ? 'var(--success)' : 'var(--warning)'
                                                }}
                                            />
                                        </div>
                                        <span className={det.confidence > 0.7 ? 'text-success' : 'text-warning'}>
                                            {(det.confidence * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Quick Reference - hidden for cleaner UI now */}
        </div>
    );
}

function VideoPlayer() {
    const [imageSrc, setImageSrc] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        const fetchFrame = async () => {
            try {
                const token = localStorage.getItem('token');
                const headers: HeadersInit = { 'ngrok-skip-browser-warning': 'true' };
                if (token) headers['Authorization'] = `Bearer ${token}`;

                const response = await fetch(`${API_URL}/api/v1/camera/snapshot`, { headers });

                if (response.ok && mounted) {
                    const blob = await response.blob();
                    const url = URL.createObjectURL(blob);
                    setImageSrc(prev => {
                        if (prev) URL.revokeObjectURL(prev);
                        return url;
                    });
                }
            } catch (e) {
                console.error(e);
            }
        };

        const interval = setInterval(fetchFrame, 200);
        return () => {
            mounted = false;
            clearInterval(interval);
        };
    }, []);

    if (!imageSrc) return (
        <div className="video-placeholder">
            <div className="spinner"></div>
            <p style={{ marginTop: 10 }}>Connecting to feed...</p>
        </div>
    );

    return (
        <img
            src={imageSrc}
            alt="Live feed"
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
    );
}
