import { FormEvent } from 'react';

interface SearchPanelProps {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  onLocate: () => void;
  statusMessage: string;
  locationSupported: boolean;
}

export default function SearchPanel({
  query,
  onQueryChange,
  onSubmit,
  onLocate,
  statusMessage,
  locationSupported
}: SearchPanelProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="panel search-panel">
      <div className="eyebrow">Find Near You</div>
      <h2>Location</h2>
      <p className="lede">
        Browse the McDonald&apos;s locations that currently appear to have a Hot &apos;n Spicy McChicken.
      </p>

      <form className="search-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>ZIP code or City, State</span>
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="60607 or Chicago, IL"
            aria-label="ZIP code or City, State"
          />
        </label>

        <div className="search-actions">
          <button className="primary-button" type="submit">
            Search Area
          </button>
          <button
            className="ghost-button"
            type="button"
            onClick={onLocate}
            disabled={!locationSupported}
          >
            Use My Location
          </button>
        </div>
      </form>

      <p className="status-copy">{statusMessage}</p>
    </section>
  );
}
