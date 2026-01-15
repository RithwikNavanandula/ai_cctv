import { useState, useEffect } from 'react';
import { apiGet, apiPost, apiDelete } from '../lib/api';
import {
    Camera,
    Plus,
    Trash2,
    Wifi,
    WifiOff,
    X
} from 'lucide-react';

interface CameraItem {
    id: string;
    name: string;
    location?: string;
    rtsp_url?: string;
    is_online: number;
}

export default function Cameras() {
    const [cameras, setCameras] = useState<CameraItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        location: '',
        rtsp_url: ''
    });

    useEffect(() => {
        fetchCameras();
    }, []);

    async function fetchCameras() {
        try {
            const data = await apiGet<CameraItem[]>('/api/v1/cameras');
            setCameras(data);
        } catch (err) {
            console.error('Failed to fetch cameras:', err);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreate() {
        try {
            await apiPost('/api/v1/cameras', formData);
            fetchCameras();
            setShowModal(false);
            setFormData({ name: '', location: '', rtsp_url: '' });
        } catch (err) {
            console.error('Failed to create camera:', err);
        }
    }

    async function handleDelete(id: string) {
        try {
            await apiDelete(`/api/v1/cameras/${id}`);
            fetchCameras();
        } catch (err) {
            console.error('Failed to delete camera:', err);
        }
    }

    return (
        <div>
            <div className="page-header">
                <div>
                    <h1 className="page-title">📹 RTSP Cameras</h1>
                    <p className="page-subtitle">Manage your camera network</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    Add Camera
                </button>
            </div>

            {loading ? (
                <div className="loading">
                    <div className="spinner"></div>
                </div>
            ) : cameras.length === 0 ? (
                <div className="card">
                    <div className="empty-state">

                        <p>No cameras configured</p>
                        <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowModal(true)}>
                            Add Your First Camera
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-3">
                    {cameras.map(cam => (
                        <div key={cam.id} className="card">
                            <div className="card-header">
                                <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

                                    {cam.name}
                                </h3>
                                <span className={`badge ${cam.is_online ? 'badge-online' : 'badge-offline'}`}>
                                    {cam.is_online ? <> Online</> : <> Offline</>}
                                </span>
                            </div>
                            <div style={{ marginBottom: 16 }}>
                                <p style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>
                                    📍 {cam.location || 'No location set'}
                                </p>
                                {cam.rtsp_url && (
                                    <p style={{ color: 'var(--text2)', fontSize: '0.8rem', marginTop: 4, wordBreak: 'break-all' }}>
                                        🔗 {cam.rtsp_url}
                                    </p>
                                )}
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                                    View Stream
                                </button>
                                <button
                                    className="btn icon-btn-danger"
                                    onClick={() => handleDelete(cam.id)}
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Add Camera Modal */}
            {showModal && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3 className="modal-title">Add New Camera</h3>
                            <button className="modal-close" onClick={() => setShowModal(false)}>

                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="form-group">
                                <label className="form-label">Camera Name *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Loading Dock A"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Location</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g. Warehouse Entry"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">RTSP URL</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.rtsp_url}
                                    onChange={(e) => setFormData({ ...formData, rtsp_url: e.target.value })}
                                    placeholder="rtsp://user:pass@192.168.1.100:554/stream"
                                />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={!formData.name}>
                                Add Camera
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
