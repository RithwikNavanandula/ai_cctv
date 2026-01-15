const DEFAULT_API_URL = 'https://unprompted-gluconeogenic-niki.ngrok-free.dev';

// Get API URL from localStorage or use default
export function getApiUrl(): string {
    return localStorage.getItem('api_url') || DEFAULT_API_URL;
}

// Set API URL in localStorage
export function setApiUrl(url: string): void {
    localStorage.setItem('api_url', url);
    // Trigger page reload to apply changes
    window.location.reload();
}

// Export for components that need the current URL
export const API_URL = getApiUrl();

function getToken(): string | null {
    return localStorage.getItem('token');
}

export function setToken(token: string): void {
    localStorage.setItem('token', token);
}

export function clearToken(): void {
    localStorage.removeItem('token');
}

export function isAuthenticated(): boolean {
    return !!getToken();
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const token = getToken();
    const apiUrl = getApiUrl(); // Get fresh URL each request
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${apiUrl}${endpoint}`, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || error.message || 'Request failed');
    }

    return response.json();
}

export async function apiGet<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint);
}

export async function apiPost<T>(endpoint: string, data?: unknown): Promise<T> {
    return request<T>(endpoint, {
        method: 'POST',
        body: data ? JSON.stringify(data) : undefined,
    });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
    return request<T>(endpoint, { method: 'DELETE' });
}

export async function apiUpload<T>(
    endpoint: string,
    formData: FormData
): Promise<T> {
    const token = getToken();
    const apiUrl = getApiUrl(); // Get fresh URL each request
    const response = await fetch(`${apiUrl}${endpoint}`, {
        method: 'POST',
        headers: {
            'ngrok-skip-browser-warning': 'true',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Upload failed');
    }

    return response.json();
}
