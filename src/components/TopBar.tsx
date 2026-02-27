import { useState, useRef, useEffect } from 'react';

interface TopBarProps {
	onToggleSettings: () => void;
	onDemo: () => void;
}

export function TopBar({ onToggleSettings, onDemo }: TopBarProps) {
	const [showLogs, setShowLogs] = useState(false);
	const [serverLogs, setServerLogs] = useState<{ ts: number; level: string; text: string }[]>([]);
	const logEndRef = useRef<HTMLDivElement | null>(null);
	const logSourceRef = useRef<EventSource | null>(null);

	useEffect(() => {
		if (showLogs && !logSourceRef.current) {
			const es = new EventSource('http://localhost:9090/logs');
			es.onmessage = (e) => {
				try {
					const entry = JSON.parse(e.data);
					setServerLogs(prev => {
						const next = [...prev, entry];
						return next.length > 300 ? next.slice(-300) : next;
					});
				} catch {}
			};
			es.onerror = () => {};
			logSourceRef.current = es;
		} else if (!showLogs && logSourceRef.current) {
			logSourceRef.current.close();
			logSourceRef.current = null;
		}
		return () => {
			if (logSourceRef.current) {
				logSourceRef.current.close();
				logSourceRef.current = null;
			}
		};
	}, [showLogs]);

	useEffect(() => {
		if (showLogs) logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
	}, [serverLogs, showLogs]);

	return (
		<div className="topbar">
			<div className="brand">Audio Visualizer</div>
			<div className="spacer" />
			<div style={{ position: 'relative' }}>
				<button
					className="icon-btn"
					onClick={() => setShowLogs(s => !s)}
					aria-label="Server Logs"
					style={{ color: showLogs ? 'var(--accent, #7aa2ff)' : undefined }}
				>
					📋 Logs
				</button>
				<button
					className="icon-btn"
					style={{ marginLeft: 8, color: '#00ffc8', fontWeight: 700 }}
					onClick={onDemo}
					aria-label="Demo Mode"
				>
					🎬 Demo
				</button>
				{showLogs && (
					<div style={{
						position: 'absolute', top: '100%', right: 0, zIndex: 1000,
						width: 480, maxHeight: 360, overflow: 'hidden',
						background: 'var(--panelBg, #181a20)', border: '1px solid var(--panelBorder, #333)',
						borderRadius: 8, boxShadow: '0 8px 32px rgba(0,0,0,.5)',
						display: 'flex', flexDirection: 'column',
					}}>
						<div style={{
							padding: '6px 10px',
							borderBottom: '1px solid var(--panelBorder, #333)',
							display: 'flex',
							justifyContent: 'space-between',
							alignItems: 'center'
						}}>
							<span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>
								Server Logs
							</span>
							<button
								onClick={() => setServerLogs([])}
								style={{
									fontSize: 11,
									background: 'none',
									border: 'none',
									color: 'var(--muted)',
									cursor: 'pointer'
								}}
							>
								Clear
							</button>
						</div>
						<div style={{
							flex: 1,
							overflowY: 'auto',
							padding: '4px 8px',
							fontFamily: 'monospace',
							fontSize: 11,
							lineHeight: 1.5
						}}>
							{serverLogs.length === 0 && (
								<div style={{ color: 'var(--muted)', padding: 8, fontStyle: 'italic' }}>
									No logs yet — waiting for server activity…
								</div>
							)}
							{serverLogs.map((l, i) => (
								<div
									key={i}
									style={{
										color: l.level === 'error' ? 'var(--danger, #ff6b6b)' : 'var(--text, #ccc)',
										whiteSpace: 'pre-wrap',
										wordBreak: 'break-all'
									}}
								>
									<span style={{ color: 'var(--muted)', marginRight: 6 }}>
										{new Date(l.ts).toLocaleTimeString()}
									</span>
									{l.text}
								</div>
							))}
							<div ref={logEndRef} />
						</div>
					</div>
				)}
			</div>
			<button className="icon-btn" onClick={onToggleSettings} aria-label="Toggle Settings">
				⚙︎ Settings
			</button>
		</div>
	);
}
