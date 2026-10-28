import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon.js';

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange(value: string): void;
  error?: string;
  hint?: ReactNode;
}

export function TextField({ label, value, onChange, error, hint, ...input }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="field">
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? hintId : undefined}
        {...input}
      />
      {(error || hint) && (
        <p id={hintId} className={error ? 'field-error' : 'field-hint'}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

interface Option<T extends string | number> {
  value: T;
  label: string;
  hint?: string;
}

interface ChoiceGroupProps<T extends string | number> {
  label: string;
  options: readonly Option<T>[];
  selected: readonly T[];
  onToggle(value: T): void;
  /** chip: pill buttons, card: big option cards (goals), square: fixed-width tiles (numbers, days). */
  variant?: 'chip' | 'card' | 'square';
  hint?: string;
  error?: string;
}

/** Single or multi select rendered as toggle buttons (aria-pressed), never a native select. */
export function ChoiceGroup<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  variant = 'chip',
  hint,
  error,
}: ChoiceGroupProps<T>) {
  const id = useId();
  return (
    <fieldset className="field choice-field" aria-describedby={error ? `${id}-err` : undefined}>
      <legend className="choice-legend">
        <span className="field-title">{label}</span>
        {hint && <span className="muted">{hint}</span>}
      </legend>
      <div className={`choices choices-${variant}`}>
        {options.map((o) => {
          const on = selected.includes(o.value);
          return (
            <button
              key={String(o.value)}
              type="button"
              className={`choice choice-${variant}`}
              aria-pressed={on}
              onClick={() => onToggle(o.value)}
            >
              {variant === 'card' ? (
                <>
                  <span className="choice-card-top">
                    <span className="choice-card-title">{o.label}</span>
                    <span className="radio" aria-hidden="true">
                      {on && <Icon name="check" size={16} />}
                    </span>
                  </span>
                  {o.hint && <span className="choice-card-hint">{o.hint}</span>}
                </>
              ) : (
                o.label
              )}
            </button>
          );
        })}
      </div>
      {error && (
        <p id={`${id}-err`} className="field-error">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
  hideLabel,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange(next: boolean): void;
  disabled?: boolean;
  /** For rows whose title is already shown next to the switch. */
  hideLabel?: boolean;
}) {
  const id = useId();
  return (
    <div className="toggle-row">
      <div className={hideLabel ? 'sr-only' : 'toggle-text'}>
        <span id={id} className="toggle-label">
          {label}
        </span>
        {description && <span className="muted">{description}</span>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={id}
        className="toggle"
        disabled={disabled}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-knob" />
      </button>
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
  error,
}: {
  checked: boolean;
  onChange(next: boolean): void;
  children: ReactNode;
  error?: string;
}) {
  return (
    <div className="field">
      <label className="checkbox">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="checkbox-box" aria-hidden="true">
          {checked && <Icon name="check" size={16} />}
        </span>
        <span className="checkbox-text">{children}</span>
      </label>
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

export function FormAlert({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="form-alert" role="alert">
      {message}
    </p>
  );
}
