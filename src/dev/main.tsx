import * as React from 'react';
import { createRoot } from 'react-dom/client';
import AssuranceLearningCalendar from '../src/webparts/assuranceLearningCalendar/components/AssuranceLearningCalendar';
import { LocalCourseService } from '../src/webparts/assuranceLearningCalendar/services/LocalCourseService';
import './harness.css';

/**
 * Local test harness: renders the web part component with the local sample list,
 * inside a frame that can be resized to mimic SharePoint section widths.
 */
const WIDTHS: Array<{ label: string; value: string }> = [
  { label: 'Full width', value: '100%' },
  { label: '1280px', value: '1280px' },
  { label: '960px', value: '960px' },
  { label: '1/2 (720px)', value: '720px' },
  { label: '1/3 (420px)', value: '420px' }
];

const service: LocalCourseService = new LocalCourseService();

interface IHarnessState {
  width: string;
}

class Harness extends React.PureComponent<object, IHarnessState> {
  public state: IHarnessState = { width: readWidth() };

  public render(): React.ReactElement {
    return (
      <>
        <div className="harness-bar">
          <strong>Local test harness</strong>
          <span>Section width:</span>
          {WIDTHS.map((w) => (
            <button
              key={w.value}
              type="button"
              className={w.value === this.state.width ? 'is-active' : ''}
              onClick={() => this._setWidth(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="harness-canvas">
          <div className="harness-section" style={{ maxWidth: this.state.width }}>
            <AssuranceLearningCalendar
              dataService={service}
              dataKey="local"
              title="Assurance Virtual Learning Enrollment Calendar"
              questionsLinkText="Audit & Assurance Learning"
              questionsLinkUrl="mailto:usaalearning2@deloitte.com"
              contactEmail="usaalearning2@deloitte.com"
              tableHeight={440}
            />
          </div>
        </div>
      </>
    );
  }

  private _setWidth(width: string): void {
    try {
      window.localStorage.setItem('alc-harness-width', width);
    } catch {
      // storage unavailable
    }
    this.setState({ width });
  }
}

function readWidth(): string {
  try {
    return window.localStorage.getItem('alc-harness-width') || '100%';
  } catch {
    return '100%';
  }
}

createRoot(document.getElementById('root') as HTMLElement).render(<Harness />);
