import { useState } from 'react';
import Select from 'react-select';
import { Modal, Button } from 'react-bootstrap';

function UserRows({
  user,
  profiles,
  uploadVisible,
  updateProfile,
  markPppoeAsExpired,
  saveQueueRate,
  addExpiredFirewallRule,
  removeExpiredFirewallRule,
}) {
  const isPPPoE = user.type === 'pppoe';
  const rowClass = isPPPoE ? 'pppoe-row' : 'queue-row';

  const [downloadValue, setDownloadValue] = useState(
    !isPPPoE ? user.download.replace(/[^\d]/g, '') : ''
  );
  const [downloadUnit, setDownloadUnit] = useState(!isPPPoE ? 'M' : 'M');
  const [uploadValue, setUploadValue] = useState(
    !isPPPoE ? user.upload.replace(/[^\d]/g, '') : ''
  );
  const [uploadUnit, setUploadUnit] = useState(!isPPPoE ? 'M' : 'M');
  const [paidUser, setPaidUser] = useState(null);
  const [selectedModalProfile, setSelectedModalProfile] = useState('');

  const [showPaidModal, setShowPaidModal] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(user.profile);
  const [selectedPaidProfile, setSelectedPaidProfile] = useState(user.profile);

  const options = profiles.map(p => ({ value: p, label: p }));

  const handleSaveQueueRate = () => {
    if (!downloadValue || (uploadVisible && !uploadValue)) {
      alert('Please enter valid rate values');
      return;
    }
    saveQueueRate(user.name);
  };

  const handleSaveProfile = () => {
    updateProfile(user.name, selectedProfile);
  };

  const handlePaidClick = (user) => {
    setPaidUser(user);
    setSelectedPaidProfile(selectedModalProfile);
    setShowPaidModal(true);
  };

  const handleUnpaidConfirmation = (user) => {
    const confirmed = window.confirm(`Are you sure you want to mark ${user.name} as EXPIRED?`);
    if (confirmed) {
      updateProfile(user.name, 'EXPIRED');
    }
  };

  const handleConfirmPaid = () => {
    updateProfile(paidUser.name, selectedModalProfile);
    setShowPaidModal(false);
  };

  return (
    <>
     <div
      className={`card mb-3 ${rowClass} shadow-sm transition-all`}
      style={{
        backgroundColor: '#f8f9fa', // light gray background
        borderLeft: `4px solid ${user.active ? '#28a745' : '#dc3545'}`, // green/red indicator
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      <div className="card-body p-3 p-md-4">
        <div className="row mb-3 align-items-center">
          <div className="col-12 col-sm-6 fw-bold text-secondary">User:</div>
          <div className="col-12 col-sm-6">
            <span className="badge bg-secondary rounded-pill px-3 py-1 text-white">
              {user.name}
            </span>
          </div>
        </div>

        {uploadVisible && (
          <>
            <div className="row mb-3 align-items-center">
              <div className="col-12 col-sm-6 fw-bold text-secondary">IP:</div>
              <div className="col-12 col-sm-6">
                <code className="bg-light p-1 rounded">{user.target || '-'}</code>
              </div>
            </div>

            {isPPPoE ? (
              <div className="row mb-3 align-items-center">
                <div className="col-12 col-sm-6 fw-bold text-secondary">Profile:</div>
                <div className="col-12 col-sm-6">
                <Select
                  options={options}
                  value={options.find(opt => opt.value === selectedProfile)}
                  onChange={selected => setSelectedProfile(selected?.value)}
                  className="react-select-container"
                  classNamePrefix="react-select"
                  menuPlacement="auto"
                  styles={{
                    control: base => ({
                      ...base,
                      minHeight: '36px',
                      borderRadius: '6px',
                      borderColor: '#ced4da',
                      boxShadow: 'none',
                      '&:hover': { borderColor: '#adb5bd' },
                    }),
                    menu: base => ({
                      ...base,
                      zIndex: 9999, 
                    }),
                    menuPortal: base => ({
                      ...base,
                      zIndex: 9999, 
                    }),
                  }}
                  menuPortalTarget={document.body} // Optional: forces the menu to render at the end of the body
                />
                </div>
              </div>
            ) : (
              <>
                <div className="row mb-3 align-items-center">
                  <div className="col-12 col-sm-6 fw-bold text-secondary">Download:</div>
                  <div className="col-12 col-sm-6">
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm shadow-none"
                        style={{
                          maxWidth: '100px',
                          borderRadius: '6px',
                          border: '1px solid #ced4da',
                        }}
                        value={downloadValue}
                        onChange={e =>
                          setDownloadValue(e.target.value.replace(/[^0-9]/g, ''))
                        }
                      />
                      <select
                        className="form-select form-select-sm shadow-none"
                        style={{
                          maxWidth: '80px',
                          borderRadius: '6px',
                          border: '1px solid #ced4da',
                        }}
                        value={downloadUnit}
                        onChange={e => setDownloadUnit(e.target.value)}
                      >
                        <option value="K">Kbps</option>
                        <option value="M">Mbps</option>
                        <option value="G">Gbps</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="row mb-3 align-items-center">
                  <div className="col-12 col-sm-6 fw-bold text-secondary">Upload:</div>
                  <div className="col-12 col-sm-6">
                    <div className="d-flex align-items-center flex-wrap gap-2">
                      <input
                        type="text"
                        className="form-control form-control-sm shadow-none"
                        style={{
                          maxWidth: '100px',
                          borderRadius: '6px',
                          border: '1px solid #ced4da',
                        }}
                        value={uploadValue}
                        onChange={e =>
                          setUploadValue(e.target.value.replace(/[^0-9]/g, ''))
                        }
                      />
                      <select
                        className="form-select form-select-sm shadow-none"
                        style={{
                          maxWidth: '80px',
                          borderRadius: '6px',
                          border: '1px solid #ced4da',
                        }}
                        value={uploadUnit}
                        onChange={e => setUploadUnit(e.target.value)}
                      >
                        <option value="K">Kbps</option>
                        <option value="M">Mbps</option>
                        <option value="G">Gbps</option>
                      </select>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <div className="row mb-3 align-items-center">
          <div className="col-12 col-sm-6 fw-bold text-secondary">Status:</div>
          <div className="col-12 col-sm-6">
            <span
              className={`badge ${
                user.active ? 'bg-success' : 'bg-danger'
              } rounded-pill px-3 py-1`}
            >
              {user.active ? 'Active' : 'Inactive'}
            </span>
          </div>
        </div>

        <div className="d-flex flex-column flex-sm-row flex-wrap gap-2 mt-4">
          {isPPPoE ? (
            <>
              <button
                className="btn btn-sm btn-primary w-100 w-sm-auto shadow-sm"
                onClick={handleSaveProfile}
                style={{ borderRadius: '6px', padding: '0.375rem 0.75rem', fontWeight: '500' }}
              >
                <i className="bi bi-save me-2"></i>Save Profile
              </button>

              <button
                className={`btn btn-sm w-100 w-sm-auto shadow-sm ${
                  user.profile === 'EXPIRED' ? 'btn-outline-secondary disabled' : 'btn-danger'
                }`}
                onClick={() => {
                  if (user.profile !== 'EXPIRED') {
                    handleUnpaidConfirmation(user);
                  }
                }}
                disabled={user.profile === 'EXPIRED'}
                style={{ borderRadius: '6px', padding: '0.375rem 0.75rem', fontWeight: '500' }}
              >
                <i
                  className={`bi ${
                    user.profile === 'EXPIRED' ? 'bi-check-circle' : 'bi-exclamation-triangle'
                  } me-2`}
                ></i>
                {user.profile === 'EXPIRED' ? 'Marked Expired' : 'Mark Unpaid'}
              </button>

              {user.profile === 'EXPIRED' && (
                <button
                  className="btn btn-sm btn-success w-100 w-sm-auto shadow-sm"
                  onClick={() => handlePaidClick(user)}
                  style={{ borderRadius: '6px', padding: '0.375rem 0.75rem', fontWeight: '500' }}
                >
                  <i className="bi bi-currency-dollar me-2"></i>Mark Paid
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn btn-sm btn-primary w-100 w-sm-auto shadow-sm"
                onClick={handleSaveQueueRate}
                style={{ borderRadius: '6px', padding: '0.375rem 0.75rem', fontWeight: '500' }}
              >
                <i className="bi bi-save me-2"></i>Save Rates
              </button>

              {user.target && user.target !== '-' && (
                <>
                  <button
                    className={`btn btn-sm w-100 w-sm-auto shadow-sm ${
                      user.expired ? 'btn-outline-secondary disabled' : 'btn-danger'
                    }`}
                    onClick={() => addExpiredFirewallRule(user.name, user.target)}
                    disabled={user.expired}
                    style={{ borderRadius: '6px', padding: '0.375rem 0.75rem', fontWeight: '500' }}
                  >
                    <i
                      className={`bi ${
                        user.expired ? 'bi-check-circle' : 'bi-exclamation-triangle'
                      } me-2`}
                    ></i>
                    {user.expired ? 'Marked Expired' : 'Mark Unpaid'}
                  </button>

                  {user.expired && (
                    <button
                      className="btn btn-sm btn-success w-100 w-sm-auto shadow-sm"
                      onClick={() => removeExpiredFirewallRule(user.name, user.target)}
                      style={{ borderRadius: '6px', padding: '0.375rem 0.75rem', fontWeight: '500' }}
                    >
                      <i className="bi bi-currency-dollar me-2"></i>Mark Paid
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>


      {/* Paid Modal */}
      <Modal show={showPaidModal} onHide={() => setShowPaidModal(false)} centered>
        <Modal.Header 
          closeButton 
          className="border-0"
          style={{ backgroundColor: '#f8f9fa' }}
        >
          <Modal.Title className="fw-bold">
            <i className="bi bi-currency-dollar me-2 text-success"></i>
            Mark as Paid
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="mb-3">
            <label className="form-label fw-bold text-muted mb-2">Select New Profile</label>
            <Select
              options={options}
              value={options.find(opt => opt.value === selectedPaidProfile)}
              onChange={selected => setSelectedModalProfile(selected.value)}
              className="react-select-container"
              classNamePrefix="react-select"
              menuPlacement="auto"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '40px',
                  borderRadius: '8px',
                  borderColor: '#dee2e6',
                  boxShadow: 'none',
                  '&:hover': {
                    borderColor: '#adb5bd'
                  }
                })
              }}
            />
          </div>
        </Modal.Body>
        <Modal.Footer className="border-0">
          <Button 
            variant="outline-secondary" 
            onClick={() => setShowPaidModal(false)}
            style={{ borderRadius: '6px', fontWeight: '500' }}
          >
            Cancel
          </Button>
          <Button 
            variant="success" 
            onClick={handleConfirmPaid}
            style={{ borderRadius: '6px', fontWeight: '500' }}
          >
            <i className="bi bi-check-circle me-2"></i>Confirm Paid
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

export default UserRows;