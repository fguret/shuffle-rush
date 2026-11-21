import * as React from 'react';
import styles from './Dropdown.module.scss';
import { Icon } from '../Icons/Icon';

export interface IDropdownProps {
  id: string;
  placeholder: string;
  options: string[];
  value: string;
  /** Typing narrows the list (autocomplete), like the Course Name filter. */
  searchable?: boolean;
  className?: string;
  onChange: (value: string) => void;
}

interface IDropdownState {
  open: boolean;
  query: string;
  activeIndex: number;
}

export class Dropdown extends React.PureComponent<IDropdownProps, IDropdownState> {
  private readonly _rootRef: React.RefObject<HTMLDivElement> = React.createRef<HTMLDivElement>();
  private readonly _inputRef: React.RefObject<HTMLInputElement> = React.createRef<HTMLInputElement>();
  private readonly _listRef: React.RefObject<HTMLUListElement> = React.createRef<HTMLUListElement>();

  constructor(props: IDropdownProps) {
    super(props);
    this.state = { open: false, query: props.value, activeIndex: -1 };
  }

  public componentDidUpdate(prevProps: IDropdownProps, prevState: IDropdownState): void {
    if (prevProps.value !== this.props.value && this.props.value !== this.state.query) {
      this.setState({ query: this.props.value });
    }
    if (this.state.open !== prevState.open) {
      if (this.state.open) {
        document.addEventListener('mousedown', this._onDocumentMouseDown);
      } else {
        document.removeEventListener('mousedown', this._onDocumentMouseDown);
      }
    }
    if (this.state.open && this.state.activeIndex !== prevState.activeIndex) {
      this._scrollActiveIntoView();
    }
  }

  public componentWillUnmount(): void {
    document.removeEventListener('mousedown', this._onDocumentMouseDown);
  }

  public render(): React.ReactElement<IDropdownProps> {
    const { id, placeholder, value, searchable, className } = this.props;
    const { open, query, activeIndex } = this.state;
    const options: string[] = this._visibleOptions();
    const listId: string = `${id}-listbox`;
    const activeId: string | undefined = open && activeIndex >= 0 ? `${id}-opt-${activeIndex}` : undefined;

    return (
      <div
        ref={this._rootRef}
        className={[styles.dropdown, open ? styles.isOpen : '', className || ''].join(' ')}
      >
        <div className={styles.field} onMouseDown={this._onFieldMouseDown}>
          {searchable ? (
            <input
              ref={this._inputRef}
              id={id}
              className={styles.input}
              type="text"
              value={query}
              placeholder={placeholder}
              aria-label={placeholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeId}
              autoComplete="off"
              onChange={this._onInputChange}
              onFocus={this._open}
              onKeyDown={this._onKeyDown}
            />
          ) : (
            <button
              id={id}
              type="button"
              className={styles.trigger}
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-controls={listId}
              aria-activedescendant={activeId}
              aria-label={value ? `${placeholder}: ${value}` : placeholder}
              onClick={this._toggle}
              onKeyDown={this._onKeyDown}
            >
              <span className={value ? styles.value : styles.placeholder}>{value || placeholder}</span>
            </button>
          )}
          <Icon name="caretDown" size={22} className={styles.caret} />
        </div>

        {open && (
          <ul ref={this._listRef} id={listId} className={styles.panel} role="listbox" aria-label={placeholder}>
            {options.length === 0 && <li className={styles.empty}>No matches</li>}
            {options.map((option, index) => (
              <li
                key={option}
                id={`${id}-opt-${index}`}
                role="option"
                aria-selected={option === value}
                className={[
                  styles.option,
                  option === value ? styles.selected : '',
                  index === activeIndex ? styles.active : ''
                ].join(' ')}
                onMouseDown={this._preventBlur}
                onClick={() => this._select(option)}
                onMouseEnter={() => this.setState({ activeIndex: index })}
              >
                {option}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  private _visibleOptions(): string[] {
    const { options, value, searchable } = this.props;
    const query: string = this.state.query.trim().toLowerCase();
    if (!searchable || !query || this.state.query === value) {
      return options;
    }
    return options.filter((o) => o.toLowerCase().indexOf(query) !== -1);
  }

  private _open = (): void => {
    if (!this.state.open) {
      const index: number = this.props.options.indexOf(this.props.value);
      this.setState({ open: true, activeIndex: index });
    }
  };

  private _close = (): void => {
    if (this.state.open) {
      this.setState({ open: false, activeIndex: -1 });
    }
  };

  private _toggle = (): void => {
    if (this.state.open) {
      this._close();
    } else {
      this._open();
    }
  };

  private _onFieldMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    // Clicking the caret area of the autocomplete focuses the input.
    if (this.props.searchable && event.target !== this._inputRef.current) {
      event.preventDefault();
      if (this._inputRef.current) {
        this._inputRef.current.focus();
      }
      this._toggle();
    }
  };

  private _preventBlur = (event: React.MouseEvent): void => {
    event.preventDefault();
  };

  private _onDocumentMouseDown = (event: MouseEvent): void => {
    const root: HTMLDivElement | null = this._rootRef.current;
    if (root && !root.contains(event.target as Node)) {
      this._close();
    }
  };

  private _onInputChange = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const query: string = event.target.value;
    this.setState({ query, open: true, activeIndex: 0 });
    this.props.onChange(query);
  };

  private _select(option: string): void {
    // Picking the selected item again clears it.
    const next: string = option === this.props.value ? '' : option;
    this.setState({ query: next, open: false, activeIndex: -1 });
    this.props.onChange(next);
  }

  private _onKeyDown = (event: React.KeyboardEvent): void => {
    const options: string[] = this._visibleOptions();
    const { open, activeIndex } = this.state;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!open) {
          this._open();
        } else {
          this.setState({ activeIndex: Math.min(options.length - 1, activeIndex + 1) });
        }
        break;
      case 'ArrowUp':
        event.preventDefault();
        if (open) {
          this.setState({ activeIndex: Math.max(0, activeIndex - 1) });
        }
        break;
      case 'Enter':
        if (open && activeIndex >= 0 && activeIndex < options.length) {
          event.preventDefault();
          this._select(options[activeIndex]);
        }
        break;
      case 'Escape':
        if (open) {
          event.preventDefault();
          this._close();
        }
        break;
      case 'Tab':
        this._close();
        break;
      default:
        break;
    }
  };

  private _scrollActiveIntoView(): void {
    const list: HTMLUListElement | null = this._listRef.current;
    if (!list || this.state.activeIndex < 0) {
      return;
    }
    const item: Element | undefined = list.children[this.state.activeIndex];
    if (item && (item as HTMLElement).scrollIntoView) {
      (item as HTMLElement).scrollIntoView({ block: 'nearest' });
    }
  }
}
