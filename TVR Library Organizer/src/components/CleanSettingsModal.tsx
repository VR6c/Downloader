import React, { useState, useEffect } from 'react';
import { X, Sliders, Plus, Trash2, Check, RefreshCw, Wand2, Save, BookmarkCheck } from 'lucide-react';
import { CleanRuleConfig } from '../types';
import { DEFAULT_PROMOTIONAL_NOISE } from '../engine/cleaner';
import { DEFAULT_TEMPLATE_PATTERN } from '../engine/templateEngine';
import { RenameTemplateCard } from './RenameTemplateCard';

interface CleanSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CleanRuleConfig;
  onSaveConfig: (newConfig: CleanRuleConfig) => void;
  activeTemplate: string;
  onSaveTemplate: (templatePattern: string) => void;
  onSetDefaultTemplate?: (templatePattern: string) => void;
}

export const CleanSettingsModal: React.FC<CleanSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  activeTemplate,
  onSaveTemplate,
  onSetDefaultTemplate,
}) => {
  const [activeTab, setActiveTab] = useState<'template' | 'rules'>('template');
  const [localConfig, setLocalConfig] = useState<CleanRuleConfig>(config);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(activeTemplate);
  const [customWord, setCustomWord] = useState('');

  // Sync state whenever modal opens or external config changes
  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setSelectedTemplate(activeTemplate);
      setCustomWord('');
    }
  }, [isOpen, config, activeTemplate]);

  if (!isOpen) return null;

  const handleAddWord = () => {
    if (!customWord.trim()) return;
    setLocalConfig({
      ...localConfig,
      customNoiseWords: [...localConfig.customNoiseWords, customWord.trim()],
    });
    setCustomWord('');
  };

  const handleRemoveWord = (index: number) => {
    const nextWords = localConfig.customNoiseWords.filter((_, i) => i !== index);
    setLocalConfig({
      ...localConfig,
      customNoiseWords: nextWords,
    });
  };

  const handleResetDefaults = () => {
    setLocalConfig({
      replaceUnderscores: true,
      normalizeWhitespace: true,
      stripPromotionalNoise: true,
      standardizeMixEnclosures: true,
      smartCapitalization: true,
      customNoiseWords: [...DEFAULT_PROMOTIONAL_NOISE],
      customSeparators: [' - ', ' _ ', ' -- ', ' | ', ' ~ '],
    });
    setSelectedTemplate(DEFAULT_TEMPLATE_PATTERN);
  };

  const handleSetAsDefault = () => {
    try {
      localStorage.setItem('tvr_default_template', selectedTemplate);
      localStorage.setItem('tvr_active_template', selectedTemplate);
    } catch {
      // ignore
    }
    if (onSetDefaultTemplate) {
      onSetDefaultTemplate(selectedTemplate);
    } else {
      onSaveTemplate(selectedTemplate);
    }
    onClose();
  };

  const handleSaveAll = () => {
    onSaveConfig(localConfig);
    onSaveTemplate(selectedTemplate);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ width: '660px', maxWidth: '94vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge">
              <Sliders size={18} />
            </div>
            <div>
              <div className="modal-title">Settings &amp; Options</div>
              <div className="modal-subtitle">Configure in-place file renaming templates and automated cleaner rules</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-card)',
          }}
        >
          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'template' ? 'active' : ''}`}
            onClick={() => setActiveTab('template')}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <Save size={15} />
            <span>Rename Template</span>
          </button>
          <button
            type="button"
            className={`view-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
            onClick={() => setActiveTab('rules')}
            style={{ padding: '6px 14px', fontSize: '0.82rem' }}
          >
            <Wand2 size={15} />
            <span>Automated Cleaning Rules</span>
          </button>
        </div>

        <div className="modal-body" style={{ padding: '22px 24px' }}>
          {activeTab === 'template' ? (
            /* TAB 1: RENAME TEMPLATE */
            <RenameTemplateCard
              value={selectedTemplate}
              onChange={setSelectedTemplate}
            />
          ) : (
            /* TAB 2: AUTOMATED CLEANING RULES */
            <div>
              <div className="form-group">
                <label className="form-label">Automated Cleaning Rules (FR-2)</label>
                <span className="form-hint" style={{ marginBottom: '8px', display: 'block' }}>
                  Applied automatically to clean filenames and standard tags when loading or cleaning library tracks.
                </span>

                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={localConfig.replaceUnderscores}
                    onChange={(e) => setLocalConfig({ ...localConfig, replaceUnderscores: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    Replace filesystem underscores and non-standard hyphens with clean spaces
                  </span>
                </label>

                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={localConfig.stripPromotionalNoise}
                    onChange={(e) => setLocalConfig({ ...localConfig, stripPromotionalNoise: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    Strip promotional noise, crew tags, and dedications (&quot;HBD To...&quot;, &quot;RockTheBeat&quot;, &quot;SRBL Team&quot;, &quot;FamilyBoss&quot;, &quot;320kbps&quot;)
                  </span>
                </label>

                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={localConfig.standardizeMixEnclosures}
                    onChange={(e) => setLocalConfig({ ...localConfig, standardizeMixEnclosures: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    Standardize mix and version markers into parenthetical enclosures (e.g. &quot;(VIP Mix)&quot;)
                  </span>
                </label>

                <label className="form-checkbox-row">
                  <input
                    type="checkbox"
                    checked={localConfig.smartCapitalization}
                    onChange={(e) => setLocalConfig({ ...localConfig, smartCapitalization: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.82rem' }}>
                    Apply Smart Title Casing while preserving DJ acronyms (DJ, MC, VIP, Tiësto, EDM)
                  </span>
                </label>
              </div>

              {/* Promotional Noise Words List */}
              <div className="form-group" style={{ marginTop: '18px' }}>
                <label className="form-label">Promotional Noise &amp; Crew Tag Patterns ({localConfig.customNoiseWords.length})</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1 }}
                    placeholder="Add custom noise word or regex pattern..."
                    value={customWord}
                    onChange={(e) => setCustomWord(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
                  />
                  <button className="btn-secondary" onClick={handleAddWord}>
                    <Plus size={15} />
                    <span>Add</span>
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    marginTop: '10px',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    padding: '8px',
                    background: 'var(--bg-tertiary)',
                    borderRadius: '8px',
                  }}
                >
                  {localConfig.customNoiseWords.map((word, idx) => (
                    <span
                      key={idx}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        background: 'var(--bg-secondary)',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        fontFamily: 'var(--font-mono)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>{word}</span>
                      <button
                        onClick={() => handleRemoveWord(idx)}
                        style={{ color: 'var(--text-muted)', cursor: 'pointer', display: 'flex' }}
                        title="Remove pattern"
                      >
                        <Trash2 size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn-secondary" onClick={handleResetDefaults} title="Reset rules and template to factory defaults">
              <RefreshCw size={14} />
              <span>Reset Defaults</span>
            </button>
            {activeTab === 'template' && (
              <button
                type="button"
                className="btn-secondary"
                onClick={handleSetAsDefault}
                title="Save this template pattern as your custom default"
              >
                <BookmarkCheck size={14} />
                <span>Set as Default</span>
              </button>
            )}
          </div>
          <button className="btn-primary" onClick={handleSaveAll}>
            <Check size={15} />
            <span>Apply &amp; Save</span>
          </button>
        </div>
      </div>
    </div>
  );
};
