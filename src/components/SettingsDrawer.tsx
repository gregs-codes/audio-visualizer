import { ReactNode } from 'react';

interface SettingsSectionProps {
	title: string;
	isOpen: boolean;
	onToggle: () => void;
	children: ReactNode;
}

export function SettingsSection({ title, isOpen, onToggle, children }: SettingsSectionProps) {
	return (
		<div className="section">
			<div className="section-header" onClick={onToggle}>
				<span className={`chevron ${isOpen ? 'open' : ''}`}>▶</span>
				{title}
			</div>
			{isOpen && <div className="section-body">{children}</div>}
		</div>
	);
}

interface SettingsDrawerProps {
	isOpen: boolean;
	children: ReactNode;
}

export function SettingsDrawer({ isOpen, children }: SettingsDrawerProps) {
	return (
		<aside className={`settings-drawer ${isOpen ? 'open' : ''}`}>
			{children}
		</aside>
	);
}
