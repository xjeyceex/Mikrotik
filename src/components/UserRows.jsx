import { useState } from "react";

function UserRows({
  user,
  profiles,
  uploadVisible,
  updateProfile,
  markPppoeAsExpired,
  saveQueueRate,
  addExpiredFirewallRule,
  removeExpiredFirewallRule,
  getUnit
}) {
  const isPPPoE = user.type === 'pppoe';
  const rowClass = isPPPoE ? 'pppoe-row' : 'queue-row';
  
  const [downloadValue, setDownloadValue] = useState(
    !isPPPoE ? user.download.replace(/[^\d]/g, '') : ''
  );
  const [downloadUnit, setDownloadUnit] = useState(
    !isPPPoE ? getUnit(user.download) : 'M'
  );
  const [uploadValue, setUploadValue] = useState(
    !isPPPoE ? user.upload.replace(/[^\d]/g, '') : ''
  );
  const [uploadUnit, setUploadUnit] = useState(
    !isPPPoE ? getUnit(user.upload) : 'M'
  );

  const handleSaveQueueRate = () => {
    if (!downloadValue || (uploadVisible && !uploadValue)) {
      alert('Please enter valid rate values');
      return;
    }
    saveQueueRate(user.name, downloadValue, downloadUnit, uploadValue, uploadUnit);
  };

  return (
    <tr className={rowClass}>
      <td>{isPPPoE ? 'PPPoE' : 'Queue'}</td>
      <td>{user.name}</td>
      <td>{user.target || '-'}</td>
      <td>
        {isPPPoE ? (
          <select
            id={`profile-select-${user.name}`}
            className="form-select form-select-sm"
            defaultValue={user.profile}
          >
            {profiles.map((profile) => (
              <option key={profile} value={profile}>
                {profile}
              </option>
            ))}
          </select>
        ) : (
          '-'
        )}
      </td>
      <td>
        {!isPPPoE ? (
          <div className="d-flex align-items-center">
            <input
              type="text"
              className="form-control form-control-sm me-1"
              style={{ width: '70px' }}
              value={downloadValue}
              onChange={(e) => setDownloadValue(e.target.value.replace(/[^0-9]/g, ''))}
            />
            <select
              className="form-select form-select-sm"
              style={{ width: '60px' }}
              value={downloadUnit}
              onChange={(e) => setDownloadUnit(e.target.value)}
            >
              <option value="K">K</option>
              <option value="M">M</option>
              <option value="G">G</option>
            </select>
          </div>
        ) : (
          '-'
        )}
      </td>
      
      {uploadVisible && (
        <td>
          {!isPPPoE ? (
            <div className="d-flex align-items-center">
              <input
                type="text"
                className="form-control form-control-sm me-1"
                style={{ width: '70px' }}
                value={uploadValue}
                onChange={(e) => setUploadValue(e.target.value.replace(/[^0-9]/g, ''))}
              />
              <select
                className="form-select form-select-sm"
                style={{ width: '60px' }}
                value={uploadUnit}
                onChange={(e) => setUploadUnit(e.target.value)}
              >
                <option value="K">K</option>
                <option value="M">M</option>
                <option value="G">G</option>
              </select>
            </div>
          ) : (
            '-'
          )}
        </td>
      )}
      
      <td className={user.active ? 'text-success fw-bold' : ''}>
        {user.active ? 'Active' : 'Inactive'}
      </td>
      
      <td>
        <div className="d-flex flex-wrap gap-1">
          {isPPPoE ? (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => updateProfile(user.name)}
              >
                Save Profile
              </button>
              
              <button
                className={`btn btn-sm ${user.profile === 'EXPIRED' ? 'btn-secondary disabled' : 'btn-danger'}`}
                onClick={() => markPppoeAsExpired(user.name)}
                disabled={user.profile === 'EXPIRED'}
              >
                {user.profile === 'EXPIRED' ? 'Already Expired' : 'Mark as Expired'}
              </button>
              
              {user.profile === 'EXPIRED' && (
                <button
                  className="btn btn-sm btn-success"
                  onClick={() => removeExpiredFirewallRule(user.name, user.target)}
                >
                  Paid
                </button>
              )}
            </>
          ) : (
            <>
              <button
                className="btn btn-sm btn-primary"
                onClick={handleSaveQueueRate}
              >
                Save Rates
              </button>
              
              {user.target && user.target !== '-' && (
                <>
                  <button
                    className={`btn btn-sm ${user.expired ? 'btn-secondary disabled' : 'btn-danger'}`}
                    onClick={() => addExpiredFirewallRule(user.name, user.target)}
                    disabled={user.expired}
                  >
                    {user.expired ? 'Already Expired' : 'Mark as Expired'}
                  </button>
                  
                  {user.expired && (
                    <button
                      className="btn btn-sm btn-success"
                      onClick={() => removeExpiredFirewallRule(user.name, user.target)}
                    >
                      Paid
                    </button>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export default UserRows;