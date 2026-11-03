import React from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { TrackItem } from '../../types';
import { CsvImportAnalysis } from '../../engine/csvEngine';

export type CsvPreviewTab = 'changes' | 'all' | 'unmatched';

type MatchedTrack = CsvImportAnalysis['matchedTracks'][number];

interface CsvPreviewTabsProps {
  analysis: CsvImportAnalysis;
  /** Matches that have at least one changed value in a currently selected field. */
  tracksWithActiveDiffs: MatchedTrack[];
  selectedFields: Set<keyof TrackItem>;
  activeTab: CsvPreviewTab;
  onTabChange: (tab: CsvPreviewTab) => void;
}

const isBlank = (v: unknown) => v === null || v === undefined || String(v).trim() === '';

const activeDiffsOf = (match: MatchedTrack, selected: Set<keyof TrackItem>) =>
  match.diffs.filter((d) => d.hasChanged && selected.has(d.field));

const ChangesPanel: React.FC<Pick<CsvPreviewTabsProps, 'analysis' | 'tracksWithActiveDiffs' | 'selectedFields'>> = ({
  analysis,
  tracksWithActiveDiffs,
  selectedFields,
}) => {
  if (tracksWithActiveDiffs.length === 0) {
    const allIdentical = analysis.totalChangedValues === 0;
    return (
      <div className="csv-empty" role="status">
        <div className="csv-empty-title">
          {allIdentical ? 'All track values are already identical!' : 'No changes in currently selected fields.'}
        </div>
        <p>
          {allIdentical
            ? 'The CSV data matches the tracks in your library with no differences.'
            : 'Check the fields with change badges above to preview and apply changes.'}
        </p>
      </div>
    );
  }

  return (
    <table className="csv-table">
      <thead>
        <tr>
          <th style={{ width: '22%' }}>Track / File</th>
          <th style={{ width: '18%' }}>Field</th>
          <th style={{ width: '28%' }}>Current Library Value</th>
          <th style={{ width: '32%' }}>New Value From CSV</th>
        </tr>
      </thead>
      <tbody>
        {tracksWithActiveDiffs.map((match) => {
          const diffs = activeDiffsOf(match, selectedFields);
          return diffs.map((diff, idx) => (
            <tr key={`${match.track.id}-${diff.field}`} className={idx % 2 ? 'is-alt' : undefined}>
              {idx === 0 && (
                <td rowSpan={diffs.length} className="csv-track-cell">
                  <div className="csv-track-title">{match.track.cleanTitle || match.track.originalFileName}</div>
                  <div className="csv-track-meta">
                    {match.track.cleanArtist || 'Unknown'} • Row #{match.csvRowIndex + 1} ({match.matchedBy})
                  </div>
                </td>
              )}
              <td className="csv-field-cell">{diff.fieldLabel}</td>
              <td>
                <span className="csv-old-value">{isBlank(diff.oldValue) ? '— (empty)' : String(diff.oldValue)}</span>
              </td>
              <td>
                <div className="csv-new-wrap">
                  <ArrowRight size={12} className="csv-new-arrow" aria-hidden="true" />
                  <span className="csv-new-value">{isBlank(diff.newValue) ? '— (cleared)' : String(diff.newValue)}</span>
                </div>
              </td>
            </tr>
          ));
        })}
      </tbody>
    </table>
  );
};

const AllMatchedPanel: React.FC<Pick<CsvPreviewTabsProps, 'analysis' | 'selectedFields'>> = ({
  analysis,
  selectedFields,
}) => (
  <table className="csv-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Track Title</th>
        <th>Producer</th>
        <th>Matched Via</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {analysis.matchedTracks.map((m, idx) => {
        const changedCount = activeDiffsOf(m, selectedFields).length;
        return (
          <tr key={m.track.id}>
            <td className="csv-muted">{idx + 1}</td>
            <td className="csv-track-title">{m.track.cleanTitle}</td>
            <td>{m.track.cleanArtist}</td>
            <td className="csv-muted csv-capitalize">{m.matchedBy.replace('_', ' ')}</td>
            <td>
              {changedCount > 0 ? (
                <span className="csv-pill">{changedCount} fields to update</span>
              ) : (
                <span className="csv-muted csv-small">No changes</span>
              )}
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

const UnmatchedPanel: React.FC<Pick<CsvPreviewTabsProps, 'analysis'>> = ({ analysis }) => (
  <div className="csv-unmatched">
    <div className="csv-unmatched-note">
      <AlertCircle size={16} aria-hidden="true" />
      <span>The following {analysis.unmatchedRows.length} rows in the CSV did not match any loaded track:</span>
    </div>
    <div className="csv-unmatched-list">
      {analysis.unmatchedRows.map((u) => (
        <div key={u.rowIndex} className="csv-unmatched-row">
          <strong>CSV Row #{u.rowIndex + 1}:</strong>{' '}
          <span>{u.rawRow['Title'] || u.rawRow['Clean Title'] || u.rawRow['Track ID'] || JSON.stringify(u.rawRow)}</span>
        </div>
      ))}
    </div>
  </div>
);

export const CsvPreviewTabs: React.FC<CsvPreviewTabsProps> = ({
  analysis,
  tracksWithActiveDiffs,
  selectedFields,
  activeTab,
  onTabChange,
}) => {
  const tabs: { id: CsvPreviewTab; label: string; danger?: boolean }[] = [
    { id: 'changes', label: `Changes Preview (${tracksWithActiveDiffs.length})` },
    { id: 'all', label: `All Matched Tracks (${analysis.matchedTracks.length})` },
    ...(analysis.unmatchedRows.length > 0
      ? [{ id: 'unmatched' as const, label: `Unmatched Rows (${analysis.unmatchedRows.length})`, danger: true }]
      : []),
  ];

  return (
    <div className="csv-preview">
      <div className="csv-tabs" role="tablist" aria-label="Import preview">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`csv-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="csv-tabpanel"
            className={`csv-tab${activeTab === tab.id ? ' is-active' : ''}${tab.danger ? ' is-danger' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="csv-panel" role="tabpanel" id="csv-tabpanel" aria-labelledby={`csv-tab-${activeTab}`}>
        {activeTab === 'changes' && (
          <ChangesPanel
            analysis={analysis}
            tracksWithActiveDiffs={tracksWithActiveDiffs}
            selectedFields={selectedFields}
          />
        )}
        {activeTab === 'all' && <AllMatchedPanel analysis={analysis} selectedFields={selectedFields} />}
        {activeTab === 'unmatched' && <UnmatchedPanel analysis={analysis} />}
      </div>
    </div>
  );
};
