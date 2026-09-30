import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { ViewPreset } from '../../types';

interface TrackGridHeaderProps {
  preset: ViewPreset;
  allSelected: boolean;
  onSelectAll: (e: React.ChangeEvent<HTMLInputElement>) => void;
  sortCol: string | null;
  sortDir: 'asc' | 'desc';
  onSort: (colKey: string) => void;
  tracksCount: number;
}

export const TrackGridHeader: React.FC<TrackGridHeaderProps> = React.memo(({
  preset,
  allSelected,
  onSelectAll,
  sortCol,
  sortDir,
  onSort,
  tracksCount,
}) => {
  const renderSortIndicator = (colKey: string) => {
    if (sortCol !== colKey) {
      return <ArrowUpDown size={11} className="sort-icon" style={{ opacity: 0.3 }} />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp size={11} className="sort-icon" />
    ) : (
      <ArrowDown size={11} className="sort-icon" />
    );
  };

  return (
    <thead>
      <tr>
        <th className="col-select">
          <input
            type="checkbox"
            checked={tracksCount > 0 && allSelected}
            onChange={onSelectAll}
            title="Select / Deselect All Tracks"
          />
        </th>
        <th className="col-num">#</th>

        {/* DJ PERFORMANCE VIEW PRESET */}
        {preset === 'dj' && (
          <>
            <th className="sortable" style={{ width: '22%', minWidth: '200px' }} onClick={() => onSort('cleanTitle')}>
              <div className="header-cell-content">
                <span>Track Title</span>
                {renderSortIndicator('cleanTitle')}
              </div>
            </th>
            <th className="sortable" style={{ width: '18%', minWidth: '150px' }} onClick={() => onSort('cleanArtist')}>
              <div className="header-cell-content">
                <span>Producer</span>
                {renderSortIndicator('cleanArtist')}
              </div>
            </th>
            <th className="sortable" style={{ width: '14%', minWidth: '130px' }} onClick={() => onSort('mixVersion')}>
              <div className="header-cell-content">
                <span>Mix / Version</span>
                {renderSortIndicator('mixVersion')}
              </div>
            </th>
            <th className="sortable" style={{ width: '90px', minWidth: '85px' }} onClick={() => onSort('bpm')}>
              <div className="header-cell-content">
                <span>BPM</span>
                {renderSortIndicator('bpm')}
              </div>
            </th>
            <th className="sortable" style={{ width: '85px', minWidth: '80px' }} onClick={() => onSort('camelotKey')}>
              <div className="header-cell-content">
                <span>Camelot</span>
                {renderSortIndicator('camelotKey')}
              </div>
            </th>
            <th className="sortable" style={{ width: '110px', minWidth: '100px' }} onClick={() => onSort('standardKey')}>
              <div className="header-cell-content">
                <span>Musical Key</span>
                {renderSortIndicator('standardKey')}
              </div>
            </th>
            <th className="sortable" style={{ width: '13%', minWidth: '120px' }} onClick={() => onSort('genre')}>
              <div className="header-cell-content">
                <span>Genre</span>
                {renderSortIndicator('genre')}
              </div>
            </th>
            <th className="sortable" style={{ width: '100px', minWidth: '95px' }} onClick={() => onSort('rating')}>
              <div className="header-cell-content">
                <span>Rating</span>
                {renderSortIndicator('rating')}
              </div>
            </th>
          </>
        )}

        {/* TECHNICAL AUDIO VIEW PRESET */}
        {preset === 'technical' && (
          <>
            <th className="sortable" style={{ width: '20%', minWidth: '200px' }} onClick={() => onSort('cleanTitle')}>
              <div className="header-cell-content">
                <span>Track Title</span>
                {renderSortIndicator('cleanTitle')}
              </div>
            </th>
            <th className="sortable" style={{ width: '95px', minWidth: '90px' }} onClick={() => onSort('bitrate')}>
              <div className="header-cell-content">
                <span>Bitrate</span>
                {renderSortIndicator('bitrate')}
              </div>
            </th>
            <th className="sortable" style={{ width: '105px', minWidth: '100px' }} onClick={() => onSort('sampleRate')}>
              <div className="header-cell-content">
                <span>Sample Rate</span>
                {renderSortIndicator('sampleRate')}
              </div>
            </th>
            <th className="sortable" style={{ width: '85px', minWidth: '80px' }} onClick={() => onSort('bitDepth')}>
              <div className="header-cell-content">
                <span>Bit Depth</span>
                {renderSortIndicator('bitDepth')}
              </div>
            </th>
            <th className="sortable" style={{ width: '90px', minWidth: '85px' }} onClick={() => onSort('duration')}>
              <div className="header-cell-content">
                <span>Duration</span>
                {renderSortIndicator('duration')}
              </div>
            </th>
            <th className="sortable" style={{ width: '90px', minWidth: '85px' }} onClick={() => onSort('fileSize')}>
              <div className="header-cell-content">
                <span>File Size</span>
                {renderSortIndicator('fileSize')}
              </div>
            </th>
            <th className="sortable" style={{ width: '85px', minWidth: '80px' }} onClick={() => onSort('fileFormat')}>
              <div className="header-cell-content">
                <span>Codec</span>
                {renderSortIndicator('fileFormat')}
              </div>
            </th>
            <th style={{ width: '140px', minWidth: '130px' }}>Quality Audit</th>
            <th style={{ width: '22%', minWidth: '220px' }}>File Path</th>
          </>
        )}

        {/* ID3 TAG EDITOR VIEW PRESET */}
        {preset === 'id3' && (
          <>
            <th className="col-artwork" style={{ width: '76px', minWidth: '76px', textAlign: 'center' }}>
              Artwork
            </th>
            <th className="sortable" style={{ width: '260px', minWidth: '220px' }} onClick={() => onSort('cleanTitle')}>
              <div className="header-cell-content">
                <span>Title</span>
                {renderSortIndicator('cleanTitle')}
              </div>
            </th>
            <th className="sortable" style={{ width: '240px', minWidth: '200px' }} onClick={() => onSort('targetFileName')}>
              <div className="header-cell-content">
                <span>File Name</span>
                {renderSortIndicator('targetFileName')}
              </div>
            </th>
            <th className="sortable" style={{ width: '170px', minWidth: '150px' }} onClick={() => onSort('cleanArtist')}>
              <div className="header-cell-content">
                <span>Producer</span>
                {renderSortIndicator('cleanArtist')}
              </div>
            </th>
            <th className="sortable" style={{ width: '150px', minWidth: '130px' }} onClick={() => onSort('album')}>
              <div className="header-cell-content">
                <span>Album</span>
                {renderSortIndicator('album')}
              </div>
            </th>
            <th className="sortable" style={{ width: '130px', minWidth: '110px' }} onClick={() => onSort('genre')}>
              <div className="header-cell-content">
                <span>Genre</span>
                {renderSortIndicator('genre')}
              </div>
            </th>
            <th className="sortable" style={{ width: '80px', minWidth: '75px' }} onClick={() => onSort('year')}>
              <div className="header-cell-content">
                <span>Year</span>
                {renderSortIndicator('year')}
              </div>
            </th>
            <th className="sortable" style={{ width: '160px', minWidth: '140px' }} onClick={() => onSort('albumArtist')}>
              <div className="header-cell-content">
                <span>Album Artist</span>
                {renderSortIndicator('albumArtist')}
              </div>
            </th>
            <th className="sortable" style={{ width: '85px', minWidth: '80px' }} onClick={() => onSort('trackNumber')}>
              <div className="header-cell-content">
                <span>Track #</span>
                {renderSortIndicator('trackNumber')}
              </div>
            </th>
            <th className="sortable" style={{ width: '110px', minWidth: '105px' }} onClick={() => onSort('tracksTotal')}>
              <div className="header-cell-content">
                <span>Tracks Total</span>
                {renderSortIndicator('tracksTotal')}
              </div>
            </th>
            <th className="sortable" style={{ width: '200px', minWidth: '170px' }} onClick={() => onSort('comments')}>
              <div className="header-cell-content">
                <span>Comment</span>
                {renderSortIndicator('comments')}
              </div>
            </th>
            <th style={{ width: '120px', minWidth: '115px' }}>Tag Format</th>
          </>
        )}
      </tr>
    </thead>
  );
});
