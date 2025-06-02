import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import UserRows from './components/UserRows';
import ConfirmationModal from './components/ConfirmationModal';

// Helper functions that don't depend on component scope can be moved outside
const ipToInt = (ip) => ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);

const App = () => {
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadVisible, setUploadVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: '',
    message: '',
    onConfirm: null,
    onCancel: null
  });

  // Memoized helper functions
  const isIpInRange = useCallback((ip, start, end) => {
    const ipInt = ipToInt(ip);
    return ipInt >= ipToInt(start) && ipInt <= ipToInt(end);
  }, []);

  const isIpInCidr = useCallback((ip, cidr) => {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
    return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
  }, []);

  const processExpiredIPs = useCallback((expiredText) => {
  if (typeof expiredText !== 'string') {
    // handle the error, or just return empty array
    return [];
  }

  const expiredIPs = [];
    const regex = /\b\d{1,3}(?:\.\d{1,3}){3}(?:-\d{1,3}(?:\.\d{1,3}){3})?|\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}\b/g;
    const matches = expiredText.match(regex) || [];

    for (const entry of matches) {
      if (entry.includes('-')) {
        const [start, end] = entry.split('-');
        expiredIPs.push({ type: 'range', start, end });
      } else if (entry.includes('/')) {
        expiredIPs.push({ type: 'cidr', value: entry });
      } else {
        expiredIPs.push({ type: 'ip', value: entry });
      }
    }
    return expiredIPs;
  }, []);

  const combineUsers = useCallback((secrets, queues, expiredIPs) => {
    const combined = [
      ...secrets.map(s => ({ ...s, type: 'pppoe' })),
      ...queues.map(q => ({ ...q, type: 'queue' }))
    ];

    return combined.map(user => {
      let expired = false;
      const ip = user.target;

      if (ip && ip !== '-') {
        for (const e of expiredIPs) {
          if (
            (e.type === 'ip' && e.value === ip) ||
            (e.type === 'range' && isIpInRange(ip, e.start, e.end)) ||
            (e.type === 'cidr' && isIpInCidr(ip, e.value))
          ) {
            expired = true;
            break;
          }
        }
      }
      return { ...user, expired };
    });
  }, [isIpInRange, isIpInCidr]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [secretsRes, queuesRes, profilesRes, expiredRes] = await Promise.all([
        axios.get('/api/secrets'),
        axios.get('/api/queues'),
        axios.get('/api/profiles'),
        axios.get('/api/firewall/expired-list')
      ]);

      const secrets = secretsRes.data;
      const queues = queuesRes.data;
      const allProfiles = profilesRes.data;
      const expiredText = expiredRes.data;

      const expiredIPs = processExpiredIPs(expiredText);
      const combinedUsers = combineUsers(secrets, queues, expiredIPs);

      setUsers(combinedUsers);
      setProfiles(allProfiles);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [processExpiredIPs, combineUsers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showConfirmation = (title, message, onConfirm, onCancel = () => setShowModal(false)) => {
    setModalConfig({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setShowModal(false);
      },
      onCancel
    });
    setShowModal(true);
  };

  const updateProfile = async (name) => {
    const select = document.getElementById(`profile-select-${name}`);
    const newProfile = select.value;

    try {
      const res = await axios.post('/api/secrets/update-profile', {
        name,
        profile: newProfile
      });
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const markPppoeAsExpired = (name) => {
    showConfirmation(
      'Confirm Action',
      `Are you sure you want to mark ${name} as expired?`,
      async () => {
        try {
          const res = await axios.post('/api/secrets/update-profile', {
            name,
            profile: 'expired'
          });
          alert(res.data.message);
          fetchData();
        } catch (err) {
          alert('Error: ' + (err.response?.data?.message || err.message));
        }
      }
    );
  };

  const saveQueueRate = async (name, downloadValue, downloadUnit, uploadValue, uploadUnit) => {
    const download = downloadValue + downloadUnit;
    const upload = uploadValue + uploadUnit;

    try {
      const res = await axios.post('/api/queues/update-rate', {
        name,
        download,
        upload
      });
      alert(res.data.message);
      fetchData();
    } catch (err) {
      alert('Error: ' + (err.response?.data?.message || err.message));
    }
  };

  const addExpiredFirewallRule = (name, ipAddress) => {
    showConfirmation(
      'Confirm Action',
      `Add firewall rule for ${name} (${ipAddress})?`,
      async () => {
        try {
          const res = await axios.post('/api/firewall/add-expired', {
            name,
            ipAddress
          });
          alert(res.data.message);
          fetchData();
        } catch (err) {
          alert('Error: ' + (err.response?.data?.message || err.message));
        }
      }
    );
  };

  const removeExpiredFirewallRule = (name, ipAddress) => {
    showConfirmation(
      'Confirm Action',
      `Remove firewall rule for ${name} (${ipAddress})?`,
      async () => {
        try {
          const res = await axios.post('/api/firewall/remove-expired', {
            name,
            ipAddress
          });
          alert(res.data.message);
          fetchData();
        } catch (err) {
          alert('Error: ' + (err.response?.data?.message || err.message));
        }
      }
    );
  };
console.log('users', users)
  const filterUsers = () => {
    if (!searchTerm) return users;
    return users.filter(user =>
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.target && user.target.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (user.profile && user.profile.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  if (loading) return <div className="container mt-3">Loading...</div>;
  if (error) return <div className="container mt-3 alert alert-danger">Error: {error}</div>;

  const filteredUsers = filterUsers();

  return (
    <div className="container mt-3">
      <h1>User Management</h1>
      <div className="mb-3">
        <button className="btn btn-primary me-2" onClick={fetchData}>Refresh Data</button>
        <button className="btn btn-secondary" onClick={() => setUploadVisible(!uploadVisible)}>
          {uploadVisible ? 'Hide Upload Rates' : 'Show Upload Rates'}
        </button>
      </div>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          placeholder="Search by name, IP or profile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      {filteredUsers.length === 0 ? (
        <div className="alert alert-info">No users found</div>
      ) : (
        <div className="table-responsive">
          <table className="table table-bordered table-hover">
            <thead className="table-light">
              <tr>
                <th>Type</th>
                <th>Name</th>
                <th>IP Address</th>
                <th>Profile</th>
                <th>Download Rate</th>
                {uploadVisible && <th>Upload Rate</th>}
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <UserRows
                  key={`${user.type}-${user.name}-${user.target}`}
                  user={user}
                  profiles={profiles}
                  uploadVisible={uploadVisible}
                  updateProfile={updateProfile}
                  markPppoeAsExpired={markPppoeAsExpired}
                  saveQueueRate={saveQueueRate}
                  addExpiredFirewallRule={addExpiredFirewallRule}
                  removeExpiredFirewallRule={removeExpiredFirewallRule}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <ConfirmationModal
        show={showModal}
        title={modalConfig.title}
        message={modalConfig.message}
        onConfirm={modalConfig.onConfirm}
        onCancel={modalConfig.onCancel}
      />
    </div>
  );
};

export default App;