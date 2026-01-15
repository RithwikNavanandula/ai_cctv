import { useState, useEffect, useRef } from 'react';
import { apiGet, apiUpload, API_URL } from '../lib/api';

interface Face {
    id: string;
    name: string;
    image_path?: string;
    created_at: string;
}

interface DetectionResult {
    name: string;
    face_id?: string;
    confidence: number;
    is_known: boolean;
}

interface FaceDetectionEvent {
    id: string;
    face_id?: string;
    name: string;
    confidence: number;
    camera_id?: string;
    detected_at: string;
}

export default function Faces() {
    const [faces, setFaces] = useState<Face[]>([]);
    const [loading, setLoading] = useState(true);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [registerName, setRegisterName] = useState('');
    const [detectionResults, setDetectionResults] = useState<DetectionResult[]>([]);
    const [recentDetections, setRecentDetections] = useState<FaceDetectionEvent[]>([]);
    const [detecting, setDetecting] = useState(false);

    const registerFileRef = useRef<HTMLInputElement>(null);
    const detectFileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchFaces();
        fetchRecentDetections();
    }, []);

    async function fetchFaces() {
        try {
            const data = await apiGet<Face[]>('/api/v1/faces');
            setFaces(data);
        } catch (err) {
            console.error('Failed to fetch faces:', err);
        } finally {
            setLoading(false);
        }
    }

    async function fetchRecentDetections() {
        try {
            const data = await apiGet<FaceDetectionEvent[]>('/api/v1/faces/detections');
            setRecentDetections(data);
        } catch (err) {
            console.error('Failed to fetch detections:', err);
        }
    }

    async function handleRegister(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !registerName) return;

        const formData = new FormData();
        formData.append('image', file);
        formData.append('name', registerName);

        try {
            await apiUpload('/api/v1/faces', formData);
            fetchFaces();
            setShowRegisterModal(false);
            setRegisterName('');
        } catch (err) {
            alert('Failed to register face: ' + (err instanceof Error ? err.message : 'Unknown error'));
        }
    }

    async function handleDetect(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setDetecting(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const result = await apiUpload<{ detections: DetectionResult[], logged: boolean }>('/api/v1/faces/detect', formData);
            setDetectionResults(result.detections);
            fetchRecentDetections(); // Refresh log
        } catch (err) {
            alert('Detection failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
        } finally {
            setDetecting(false);
            e.target.value = '';
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">👤 Face Recognition</h1>
                    <p className="page-subtitle">Register faces and detect people in images</p>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn btn-secondary" onClick={() => detectFileRef.current?.click()} disabled={detecting}>
                        {detecting ? 'Detecting...' : 'Detect Faces'}
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowRegisterModal(true)}>
                        Register Face
                    </button>
                </div>
            </div>

            <input type="file" ref={detectFileRef} accept="image/*" style={{ display: 'none' }} onChange={handleDetect} />

            {/* Detection Results */}
            {detectionResults.length > 0 && (
                <div className="card" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h3 className="card-title"> Detection Results</h3>
                        <button className="btn btn-sm btn-secondary" onClick={() => setDetectionResults([])}>
                            Clear
                        </button>
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                        {detectionResults.map((result, idx) => (
                            <div key={idx} className={`face-result-card ${result.is_known ? 'known' : 'unknown'}`}>
                                <div className={`face-result-avatar ${result.is_known ? 'known' : 'unknown'}`}>
                                    {result.is_known ? result.name.charAt(0) : '?'}
                                </div>
                                <strong>{result.name}</strong>
                                <p style={{ fontSize: '0.8rem', color: result.is_known ? 'var(--success)' : 'var(--error)' }}>
                                    {result.confidence.toFixed(1)}% match
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-2">
                {/* Registered Faces */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">📸 Registered Faces ({faces.length})</h3>
                    </div>
                    {loading ? (
                        <div className="loading"><div className="spinner"></div></div>
                    ) : faces.length === 0 ? (
                        <div className="empty-state">

                            <p>No faces registered yet</p>
                        </div>
                    ) : (
                        <div className="registered-face-grid">
                            {faces.map(face => (
                                <div key={face.id} className="registered-face-card">
                                    <div className="registered-face-avatar">
                                        {face.name.charAt(0).toUpperCase()}
                                    </div>
                                    <strong style={{ fontSize: '0.85rem' }}>{face.name}</strong>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Detections Log */}
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> Detection Log</h3>
                    </div>
                    {recentDetections.length === 0 ? (
                        <div className="empty-state">

                            <p style={{ fontSize: '0.9rem' }}>No detections yet</p>
                        </div>
                    ) : (
                        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                            {recentDetections.slice(0, 20).map(det => (
                                <div key={det.id} className="log-entry">
                                    <div>
                                        <strong>{det.name}</strong>
                                        <span className={`badge ${det.face_id ? 'badge-in' : 'badge-expired'}`} style={{ marginLeft: 8 }}>
                                            {det.face_id ? 'Known' : 'Unknown'}
                                        </span>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>
                                        {new Date(det.detected_at).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Register Modal */}
            {showRegisterModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Register New Face</h3>
                            <button className="modal-close" onClick={() => setShowRegisterModal(false)}>

                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={registerName}
                                    onChange={(e) => setRegisterName(e.target.value)}
                                    placeholder="Enter person's name"
                                />
                            </div>
                            <input type="file" ref={registerFileRef} accept="image/*" style={{ display: 'none' }} onChange={handleRegister} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowRegisterModal(false)}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                disabled={!registerName}
                                onClick={() => registerFileRef.current?.click()}
                            >
                                Upload Photo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
