
interface PageHeaderProps {
    title: string;
    description: string;
    action?: React.ReactNode;
}

export function PageHeader({ title, description, action }: PageHeaderProps) {
    return (
        <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
                <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>{title}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>{description}</p>
            </div>
            {action && <div>{action}</div>}
        </div>
    );
}
