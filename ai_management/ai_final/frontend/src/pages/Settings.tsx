import { useState } from 'react';
import { getApiUrl, setApiUrl } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { PageHeader } from '../components/ui/PageHeader';

export default function Settings() {
    const [apiUrl, setApiUrlLocal] = useState(getApiUrl());
    const { addToast } = useToast();

    function handleSave() {
        if (apiUrl && apiUrl !== getApiUrl()) {
            setApiUrl(apiUrl);
            addToast('Settings saved! Reloading...', 'success');
        } else {
            addToast('No changes to save', 'info');
        }
    }

    function handleReset() {
        const defaultUrl = 'https://unprompted-gluconeogenic-niki.ngrok-free.dev';
        setApiUrlLocal(defaultUrl);
        setApiUrl(defaultUrl);
        addToast('Reset to default URL', 'success');
    }

    return (
        <div>
            <PageHeader
                title="Settings"
                subtitle="Configure the AI CCTV system"
            />

            <div className="grid grid-2">
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> Backend Connection</h3>
                    </div>
                    <div className="form-group">
                        <label className="form-label">API URL (Ngrok)</label>
                        <input
                            type="text"
                            className="input"
                            value={apiUrl}
                            onChange={(e) => setApiUrlLocal(e.target.value)}
                            placeholder="https://your-ngrok-url.ngrok-free.dev"
                        />
                        <p className="text-muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                            Enter your Colab ngrok URL. Changes will reload the page.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                        <button className="btn btn-primary" onClick={handleSave}>
                            Save URL
                        </button>
                        <button className="btn btn-secondary" onClick={handleReset}>
                            Reset to Default
                        </button>
                    </div>
                    <div className="info-box" style={{ marginTop: 16 }}>
                        <strong>Current URL:</strong><br />
                        <code>{getApiUrl()}</code>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> Database</h3>
                    </div>
                    <div className="status-list">
                        <div className="status-row">
                            <span>Type</span>
                            <strong>SQLite</strong>
                        </div>
                        <div className="status-row">
                            <span>File</span>
                            <strong>aicctv.db</strong>
                        </div>
                        <div className="status-row">
                            <span>Backup</span>
                            <strong>Google Drive (auto)</strong>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> Detection Models</h3>
                    </div>
                    <div className="status-list">
                        <div className="status-row">
                            <span>Main Model</span>
                            <strong>best_dec20.pt</strong>
                        </div>
                        <div className="status-row">
                            <span>Sugar Models</span>
                            <strong>3 variants</strong>
                        </div>
                        <div className="status-row">
                            <span>Face Recognition</span>
                            <strong>Enabled</strong>
                        </div>
                    </div>
                </div>

                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title"> About</h3>
                    </div>
                    <div className="status-list">
                        <div className="status-row">
                            <span>Version</span>
                            <strong>2.0.0</strong>
                        </div>
                        <div className="status-row">
                            <span>Stack</span>
                            <strong>React + Flask + Colab</strong>
                        </div>
                        <div className="status-row">
                            <span>AI Engine</span>
                            <strong>YOLOv8 + Face Recognition</strong>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

