import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiPost, setToken } from '../lib/api';

export default function Login() {
    const [email, setEmail] = useState('demo@aicctv.com');
    const [password, setPassword] = useState('demo123');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await apiPost<{ access_token: string }>('/api/v1/auth/login', {
                email,
                password,
            });
            setToken(response.access_token);
            navigate('/');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed');
        } finally {
            setLoading(false);
        }
    }

    return (

        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <div className="login-icon-wrapper">
                        <div className="login-icon">📹</div>
                    </div>
                    <h1 className="login-title">AI CCTV</h1>
                    <p className="login-subtitle">Sign in to your account</p>
                </div>

                {error && (
                    <div className="login-error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Email</label>
                        <div className="form-group-relative">
                            <input
                                type="email"
                                className="input input-with-icon"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <div className="form-group-relative">
                            <input
                                type="password"
                                className="input input-with-icon"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: 8 }}
                        disabled={loading}
                    >
                        {loading ? 'Signing in...' : 'Sign In'}
                    </button>
                </form>

                <p className="login-footer">
                    Demo: demo@aicctv.com / demo123
                </p>
            </div>
        </div>
    );
}
