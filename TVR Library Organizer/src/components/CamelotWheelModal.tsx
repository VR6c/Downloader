import React, { useState } from 'react';
import { X, Layers, Sparkles, Filter } from 'lucide-react';
import { CAMELOT_COLORS, CAMELOT_MAP, getCamelotKeyInfo } from '../engine/camelot';

interface CamelotWheelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFilterByKey: (key: string) => void;
}

export const CamelotWheelModal: React.FC<CamelotWheelModalProps> = ({
  isOpen,
  onClose,
  onFilterByKey,
}) => {
  const [selectedKey, setSelectedKey] = useState<string>('8A');

  if (!isOpen) return null;

  const keyInfo = getCamelotKeyInfo(selectedKey);

  // Camelot wheel numbers 1 to 12 arranged radially (12 at top, 3 at right, 6 at bottom, 9 at left)
  // Angle = (num - 3) * (360 / 12)
  const renderWheelButtons = (isMinor: boolean) => {
    const radius = isMinor ? 100 : 145; // inner ring (A - minor) vs outer ring (B - major)
    const letter = isMinor ? 'A' : 'B';

    return Array.from({ length: 12 }, (_, i) => {
      const num = i + 1;
      const keyCode = `${num}${letter}`;
      // In Camelot clock: 12 is at 12 o'clock (-90 deg), 1 is at 1 o'clock (-60 deg), etc.
      const angleDeg = (num * 30) - 90;
      const angleRad = (angleDeg * Math.PI) / 180;
      const cx = 180 + radius * Math.cos(angleRad);
      const cy = 180 + radius * Math.sin(angleRad);
      const color = CAMELOT_COLORS[num];
      const isSelected = selectedKey === keyCode;

      return (
        <button
          key={keyCode}
          className={`wheel-slice-btn ${isSelected ? 'selected' : ''}`}
          style={{
            left: `${cx - 24}px`,
            top: `${cy - 19}px`,
            backgroundColor: color,
          }}
          onClick={() => setSelectedKey(keyCode)}
          title={`${keyCode}: ${CAMELOT_MAP[keyCode]?.musicalKey}`}
        >
          {keyCode}
        </button>
      );
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" style={{ width: '640px' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <div className="modal-icon-badge" style={{ background: 'rgba(226, 61, 61, 0.15)', color: '#E23D3D' }}>
              <Layers size={18} />
            </div>
            <div>
              <div className="modal-title">Camelot Harmonic Wheel</div>
              <div className="modal-subtitle">Interactive harmonic mixing rules & key compatibility</div>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="camelot-wheel-container">
            {/* Interactive Radial Wheel */}
            <div className="camelot-interactive-wheel">
              {renderWheelButtons(false)} {/* Outer Ring: Major (B) */}
              {renderWheelButtons(true)}  {/* Inner Ring: Minor (A) */}

              {/* Center Hub displaying active key details */}
              <div className="wheel-center-hub">
                <span className="hub-key-code">{selectedKey}</span>
                <span className="hub-musical-key">{keyInfo?.musicalKey}</span>
                <span className="hub-tip">{keyInfo?.mode.toUpperCase()}</span>
              </div>
            </div>

            {/* Harmonic Mixing Rules Cards */}
            {keyInfo && (
              <div className="harmonic-tips-grid">
                <div className="harmonic-tip-card">
                  <div
                    className="harmonic-tip-icon"
                    style={{ backgroundColor: keyInfo.hexColor }}
                  >
                    {keyInfo.compatibleKeys.sameKey}
                  </div>
                  <div className="harmonic-tip-info">
                    <div className="harmonic-tip-title">Perfect Match</div>
                    <div className="harmonic-tip-desc">Same key — seamlessly identical tonality.</div>
                  </div>
                </div>

                <div className="harmonic-tip-card">
                  <div
                    className="harmonic-tip-icon"
                    style={{ backgroundColor: keyInfo.hexColor, opacity: 0.9 }}
                  >
                    {keyInfo.compatibleKeys.relativeKey}
                  </div>
                  <div className="harmonic-tip-info">
                    <div className="harmonic-tip-title">Relative {keyInfo.mode === 'minor' ? 'Major' : 'Minor'}</div>
                    <div className="harmonic-tip-desc">Changes emotional mood without clashing.</div>
                  </div>
                </div>

                <div className="harmonic-tip-card">
                  <div
                    className="harmonic-tip-icon"
                    style={{ backgroundColor: CAMELOT_COLORS[parseInt(keyInfo.compatibleKeys.energyUp, 10)] }}
                  >
                    {keyInfo.compatibleKeys.energyUp}
                  </div>
                  <div className="harmonic-tip-info">
                    <div className="harmonic-tip-title">Energy Lift (+1 Step)</div>
                    <div className="harmonic-tip-desc">Raises room energy smoothly into next drop.</div>
                  </div>
                </div>

                <div className="harmonic-tip-card">
                  <div
                    className="harmonic-tip-icon"
                    style={{ backgroundColor: CAMELOT_COLORS[parseInt(keyInfo.compatibleKeys.energyBoost, 10)] }}
                  >
                    {keyInfo.compatibleKeys.energyBoost}
                  </div>
                  <div className="harmonic-tip-info">
                    <div className="harmonic-tip-title">Power Boost (+2 Steps)</div>
                    <div className="harmonic-tip-desc">High-voltage modulation for festival peaks.</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="btn-primary"
            onClick={() => {
              onFilterByKey(selectedKey);
              onClose();
            }}
          >
            <Filter size={15} />
            <span>Filter Library by {selectedKey}</span>
          </button>
          <button className="btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
