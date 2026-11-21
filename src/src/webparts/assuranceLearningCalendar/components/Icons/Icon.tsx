import * as React from 'react';

export type IconName =
  | 'check'
  | 'refresh'
  | 'arrowUp'
  | 'calendar'
  | 'chevronLeft'
  | 'chevronRight'
  | 'caretDown'
  | 'close'
  | 'external';

export interface IIconProps {
  name: IconName;
  size?: number;
  className?: string;
  strokeWidth?: number;
}

const PATHS: Record<IconName, React.ReactNode> = {
  check: <polyline points="5 12.5 10 17 19 7.5" />,
  refresh: (
    <>
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <polyline points="19.8 4.5 19.8 8.6 15.7 8.6" />
    </>
  ),
  arrowUp: (
    <>
      <line x1="12" y1="19.5" x2="12" y2="5" />
      <polyline points="6.5 10.5 12 5 17.5 10.5" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5.5" width="16" height="14.5" rx="1.2" />
      <line x1="4" y1="9.5" x2="20" y2="9.5" />
      <line x1="8.5" y1="3.5" x2="8.5" y2="7" />
      <line x1="15.5" y1="3.5" x2="15.5" y2="7" />
      <rect x="7.5" y="12.5" width="3.5" height="3.5" fill="currentColor" stroke="none" />
    </>
  ),
  chevronLeft: <polyline points="15 5 8 12 15 19" />,
  chevronRight: <polyline points="9 5 16 12 9 19" />,
  caretDown: <polygon points="7 10 12 15 17 10" fill="currentColor" stroke="none" />,
  close: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  external: (
    <>
      <path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5" />
      <polyline points="14 4 20 4 20 10" />
      <line x1="10.5" y1="13.5" x2="20" y2="4" />
    </>
  )
};

/** Inline SVG icon set (no icon-font dependency). */
export class Icon extends React.PureComponent<IIconProps> {
  public render(): React.ReactElement<IIconProps> {
    const { name, size = 24, className, strokeWidth = 2 } = this.props;
    return (
      <svg
        className={className}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {PATHS[name]}
      </svg>
    );
  }
}
