import React, { useMemo } from 'react';
import {
  Wand2,
  Edit3,
  SearchCode,
  Compass,
  FilePlus,
  FolderPlus,
  Layers,
  SlidersHorizontal,
  TableProperties,
  RefreshCw,
  Eraser,
  ListFilter,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Disc3,
  Save,
} from 'lucide-react';
import { ViewPreset } from '../types';
import { SelectDropdown, SelectOption } from './SelectDropdown';
import { SearchBar, Button } from './ui';

interface ToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filterMode: string;
  onFilterModeChange: (mode: string) => void;
  activePreset: ViewPreset;
  onPresetChange: (preset: ViewPreset) => void;
  selectedCount: number;
  onAutoClean: () => void;
  onSyncNameAndTitle?: () => void;
  onCleanAllFields?: () => void;
  onSaveSelected?: () => void;
  onOpenBulkEdit: () => void;
  onOpenFindReplace: () => void;
  onOpenCamelotWheel: () => void;
  onAddFiles: () => void;
  onAddDirectory: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = React.memo(({
  searchQuery,
  onSearchChange,
  filterMode,
  onFilterModeChange,
  activePreset,
  onPresetChange,
  selectedCount,
  onAutoClean,
  onSyncNameAndTitle,
  onCleanAllFields,
  onSaveSelected,
  onOpenBulkEdit,
  onOpenFindReplace,
  onOpenCamelotWheel,
  onAddFiles,
  onAddDirectory,
}) => {
  const filterOptions: SelectOption[] = useMemo(() => {
    const base: SelectOption[] = [
      {
        value: 'all',
        label: 'All Tracks',
        icon: <ListFilter size={14} style={{ color: 'var(--accent-primary)' }} />,
      },
      {
        value: 'needs-analysis',
        label: 'Needs Analysis',
        icon: <Sparkles size={14} style={{ color: 'var(--warning)' }} />,
      },
      {
        value: 'analyzed',
        label: 'Analyzed Only',
        icon: <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />,
      },
      {
        value: 'quality-warnings',
        label: 'Quality Alerts',
        icon: <AlertTriangle size={14} style={{ color: 'var(--warning)' }} />,
      },
      {
        value: 'errors',
        label: 'Errors Only',
        icon: <AlertCircle size={14} style={{ color: 'var(--danger)' }} />,
      },
    ];

    if (filterMode.startsWith('key:')) {
      base.push({
        value: filterMode,
        label: `Camelot: ${filterMode.replace('key:', '')}`,
        icon: <Disc3 size={14} style={{ color: '#E23D3D' }} />,
      });
    }

    return base;
  }, [filterMode]);

  return (
    <div className="app-toolbar">
      <div className="toolbar-left">
        {/* Reusable SearchBar Component */}
        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search tracks, producers..."
          size="sm"
          shortcut="/"
          ariaLabel="Search audio library tracks and metadata"
        />

        {/* Filter Dropdown */}
        <SelectDropdown
          value={filterMode}
          onChange={onFilterModeChange}
          options={filterOptions}
          size="sm"
          variant="toolbar"
          title="Filter tracks view"
          ariaLabel="Filter tracks view"
          menuMinWidth={185}
        />

        {/* View Presets Switcher (FR-3.4) */}
        <div className="view-tabs">
          <button
            className={`view-tab-btn ${activePreset === 'id3' ? 'active' : ''}`}
            onClick={() => onPresetChange('id3')}
            title="ID3 Tag Editor View: Artwork, Title, File Name, Producer, Album, Genre, Year, Album Artist, Track #, Tracks Total, Comment, Tag Format"
          >
            <TableProperties size={14} />
            <span className="btn-label-long">ID3 Tags</span>
            <span className="btn-label-short">ID3</span>
          </button>
          <button
            className={`view-tab-btn ${activePreset === 'dj' ? 'active' : ''}`}
            onClick={() => onPresetChange('dj')}
            title="DJ Performance View: Title, Producer, BPM, Camelot Key, Mix/Version, Rating"
          >
            <Compass size={14} />
            <span className="btn-label-long">DJ View</span>
            <span className="btn-label-short">DJ</span>
          </button>
          <button
            className={`view-tab-btn ${activePreset === 'technical' ? 'active' : ''}`}
            onClick={() => onPresetChange('technical')}
            title="Technical Audio View: Sample Rate, Bitrate, Bit Depth, Duration, File Size, File Path"
          >
            <SlidersHorizontal size={14} />
            <span className="btn-label-long">Technical</span>
            <span className="btn-label-short">Tech</span>
          </button>
        </div>
      </div>

      <div className="toolbar-right">
        {/* Auto Clean Button (FR-2) */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Wand2 size={15} />}
          labelLong="Auto-Clean"
          labelShort="Clean"
          onClick={onAutoClean}
          title="Automated Filename & Metadata Cleaning Engine: Strips noise, crew tags, and standardizes mix enclosures"
        />

        {/* Sync = Set FileName(Rename Template) To Title */}
        {onSyncNameAndTitle && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={15} />}
            labelLong="Sync"
            labelShort="Sync"
            onClick={onSyncNameAndTitle}
            title="Sync = Set FileName(Rename Template) To Title"
          />
        )}

        {/* Clean All Fields */}
        {onCleanAllFields && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Eraser size={15} />}
            labelLong="Clean Fields"
            labelShort="Clean"
            onClick={onCleanAllFields}
            title="Clean up all tag fields (exclude FileName, Tag Format, Bit Rate, Duration, File Size, Codec, File Path) for selected tracks or all tracks"
          />
        )}

        {/* Bulk Edit Button */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Edit3 size={15} />}
          labelLong={`Bulk Edit ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
          labelShort={`Edit ${selectedCount > 0 ? `(${selectedCount})` : ''}`}
          onClick={onOpenBulkEdit}
          disabled={selectedCount === 0}
          title={selectedCount > 0 ? `Bulk Edit ${selectedCount} selected tracks` : 'Select 1 or more tracks to bulk edit'}
        />

        {/* Find & Replace (FR-3.3) */}
        <Button
          variant="secondary"
          size="sm"
          icon={<SearchCode size={15} />}
          labelLong="Find & Replace"
          labelShort="Find"
          onClick={onOpenFindReplace}
          title="Find & Replace text or regex patterns across columns"
        />

        {/* Camelot Wheel Reference */}
        <Button
          variant="secondary"
          size="sm"
          icon={<Layers size={15} />}
          labelLong="Camelot"
          labelShort="Camelot"
          onClick={onOpenCamelotWheel}
          title="Interactive Camelot Harmonic Wheel and Harmonic Mixing Guide"
        />

        <div className="toolbar-separator" />

        {/* Add files / folder */}
        <Button
          variant="secondary"
          size="sm"
          icon={<FilePlus size={15} />}
          labelLong="+ Files"
          labelShort="Files"
          onClick={onAddFiles}
          title="Add loose audio files (.mp3, .wav, .flac, .aiff)"
        />

        <Button
          variant="secondary"
          size="sm"
          icon={<FolderPlus size={15} />}
          labelLong="+ Folder"
          labelShort="Folder"
          onClick={onAddDirectory}
          title="Scan entire music folder or Rekordbox USB drive"
        />
      </div>
    </div>
  );
});
