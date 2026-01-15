import { useState, useRef } from 'react';
import { apiUpload, API_URL } from '../lib/api';
import { PageHeader } from '../components/ui/PageHeader';
import { useToast } from '../components/ui/Toast';

interface Job {
    job_id: string;
    status: string;
    original_size: number;
    compressed_size?: number;
    compression_ratio?: number;
    download_url?: string;
    original_filename?: string;
}

export default function Compression() {
    const [jobs, setJobs] = useState<Job[]>([]);
    const [uploading, setUploading] = useState(false);
    const [level, setLevel] = useState('medium');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { addToast } = useToast();

    async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('level', level);

        try {
            const job = await apiUpload<Job>('/api/v1/compression/upload', formData);
            setJobs([job, ...jobs]);
            addToast(`Compression started: ${file.name}`, 'success');
            pollJobStatus(job.job_id);
        } catch (err) {
            addToast('Upload failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    }

    async function pollJobStatus(jobId: string) {
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${API_URL}/api/v1/compression/status/${jobId}`, {
                    headers: {
                        'ngrok-skip-browser-warning': 'true',
                        Authorization: `Bearer ${localStorage.getItem('token') || ''}`
                    }
                });
                const job = await response.json();

                setJobs(prev => prev.map(j => j.job_id === jobId ? { ...j, ...job } : j));

                if (job.status === 'completed') {
                    addToast('Compression complete!', 'success');
                    clearInterval(interval);
                } else if (job.status === 'failed') {
                    addToast('Compression failed', 'error');
                    clearInterval(interval);
                }
            } catch (err) {
                clearInterval(interval);
            }
        }, 2000);
    }

    function formatBytes(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    return (
        <div>
            <PageHeader
                title="Video Compression"
                subtitle="Compress DAV, MP4, AVI, MKV videos with H.264"
            />

            {/* Upload Card */}
            <div className="card" style={{ marginBottom: 24 }}>
                <div className="card-header">
                    <h3 className="card-title"> Upload Video</h3>
                </div>
                <div className="compression-upload-row" style={{ display: 'flex', gap: 16, alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                        <label className="form-label">Compression Level</label>
                        <select className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
                            <option value="medium">Medium (CRF 28)</option>
                            <option value="high">High (CRF 35)</option>
                        </select>
                    </div>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".dav,.mp4,.avi,.mkv"
                        style={{ display: 'none' }}
                        onChange={handleUpload}
                    />
                    <button
                        className="btn btn-primary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                    >
                        {uploading ? 'Uploading...' : 'Select File'}
                    </button>
                </div>
            </div>

            {/* Jobs List */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"> Compression Jobs</h3>
                </div>
                {jobs.length === 0 ? (
                    <div className="empty-state">

                        <p>No compression jobs yet</p>
                    </div>
                ) : (
                    <div className="status-list">
                        {jobs.map(job => (
                            <div key={job.job_id} className="job-card">
                                <div>
                                    <strong>{job.original_filename || job.job_id}</strong>
                                    <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
                                        Original: {formatBytes(job.original_size)}
                                        {job.compressed_size && ` → ${formatBytes(job.compressed_size)}`}
                                        {job.compression_ratio && ` (${job.compression_ratio}% saved)`}
                                    </p>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    {job.status === 'processing' && (
                                        <span className="badge badge-warning">
                                            Processing
                                        </span>
                                    )}
                                    {job.status === 'completed' && (
                                        <>
                                            <span className="badge badge-active">
                                                Complete
                                            </span>
                                            <a
                                                href={`${API_URL}${job.download_url}`}
                                                className="btn btn-secondary btn-sm" // Changed to secondary for consistency
                                                download
                                                style={{ color: 'var(--success)', borderColor: 'var(--success)' }}
                                            >
                                                Download
                                            </a>
                                        </>
                                    )}
                                    {job.status === 'failed' && (
                                        <span className="badge badge-expired">
                                            Failed
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

