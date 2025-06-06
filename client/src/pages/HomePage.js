import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import UserRows from '../components/UserRows';
import ConfirmationModal from '../components/ConfirmationModal';

const ipToInt = ip =>
  ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);

const HomePage = () => {
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
    onCancel: null,
  });
  const [expiredStatus, setExpiredStatus] = useState({}); // Track expired status

  const isIpInRange = useCallback((ip, start, end) => {
    const ipInt = ipToInt(ip);
    return ipInt >= ipToInt(start) && ipInt <= ipToInt(end);
  }, []);

  const isIpInCidr = useCallback((ip, cidr) => {
    const [range, bits] = cidr.split('/');
    const mask = ~(2 ** (32 - parseInt(bits, 10)) - 1);
    return (ipToInt(ip) & mask) === (ipToInt(range) & mask);
  }, []);

  const processExpiredIPs = useCallback(expiredText => {
    if (typeof expiredText !== 'string') return [];
    
    const expiredIPs = [];
    const regex =
      /\b\d{1,3}(?:\.\d{1,3}){3}(?:-\d{1,3}(?:\.\d{1,3}){3})?|\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}\b/g;
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

  const combineUsers = useCallback(
    (secrets, queues, expiredIPs) => {
      const combined = [
        ...secrets.map(s => ({ ...s, type: 'pppoe' })),
        ...queues.map(q => ({ ...q, type: 'queue' })),
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
    },
    [isIpInRange, isIpInCidr]
  );

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [secretsRes, queuesRes, profilesRes, expiredRes] =
        await Promise.all([
          axios.get('/api/secrets'),
          axios.get('/api/queues'),
          axios.get('/api/profiles'),
          axios.get('/api/firewall/expired-list', { responseType: 'text' }),
        ]);

      const secrets = secretsRes.data;
      const queues = queuesRes.data;
      const allProfiles = profilesRes.data;
      const expiredText = expiredRes.data;

      const expiredIPs = processExpiredIPs(expiredText);
      const combinedUsers = combineUsers(secrets, queues, expiredIPs);

      setUsers(combinedUsers);
      setProfiles(allProfiles);
      
      // Initialize expired status
      const initialExpiredStatus = {};
      combinedUsers.forEach(user => {
        initialExpiredStatus[user.name] = user.expired || false;
      });
      setExpiredStatus(initialExpiredStatus);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [processExpiredIPs, combineUsers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const showConfirmation = (
    title,
    message,
    onConfirm,
    onCancel = () => setShowModal(false)
  ) => {
    setModalConfig({
      title,
      message,
      onConfirm: () => {
        onConfirm();
        setShowModal(false);
      },
      onCancel,
    });
    setShowModal(true);
  };

  const updateProfile = async (name, profile) => {
    try {
      const res = await fetch('/api/secrets/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, profile }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to update profile');
      }

      const result = await res.json();
      alert(result.message);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const markPppoeAsExpired = name => {
    if (expiredStatus[name]) return;

    showConfirmation(
      'Confirm Action',
      `Are you sure you want to mark ${name} as expired? This will set their profile to "expired".`,
      async () => {
        try {
          const res = await fetch('/api/secrets/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, profile: 'expired' }),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to update profile');
          }

          const result = await res.json();
          alert(result.message);

          // Update the expired status in state
          setExpiredStatus(prev => ({
            ...prev,
            [name]: true
          }));

          fetchData();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      }
    );
  };

  const saveQueueRate = async name => {
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const downloadInput = document.getElementById(`download-${safeName}`);
    const downloadUnit = document.getElementById(
      `download-unit-${safeName}`
    ).value;
    let uploadValue, uploadUnit;

    if (uploadVisible) {
      const uploadInput = document.getElementById(`upload-${safeName}`);
      uploadValue = uploadInput.value.replace(/[^0-9]/g, '');
      uploadUnit = document.getElementById(`upload-unit-${safeName}`).value;
      if (!uploadValue) {
        alert('Upload rate cannot be empty.');
        return;
      }
    } else {
      uploadValue = downloadInput.value.replace(/[^0-9]/g, '');
      uploadUnit = downloadUnit;
    }

    const download = downloadInput.value.replace(/[^0-9]/g, '') + downloadUnit;
    const upload = uploadValue + uploadUnit;

    if (!download || !upload) {
      alert('Download and Upload rates cannot be empty.');
      return;
    }

    try {
      const res = await fetch('/api/queues/update-rate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, download, upload }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Failed to update queue rate');
      }

      const result = await res.json();
      alert(result.message);
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
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
            ipAddress,
          });
          alert(res.data.message);
          
          // Update the expired status in state
          setExpiredStatus(prev => ({
            ...prev,
            [name]: true
          }));
          
          fetchData();
        } catch (err) {
          alert('Error: ' + (err.response?.data?.message || err.message));
        }
      }
    );
  };

  const removeExpiredFirewallRule = (name, ipAddress) => {
    if (!ipAddress || ipAddress === '-') {
      alert('No valid IP address found for this user');
      return;
    }

    showConfirmation(
      'Confirm Action',
      `Are you sure you want to remove the "EXPIRED" firewall rule for ${name} (${ipAddress})?`,
      async () => {
        try {
          const res = await fetch('/api/firewall/remove-expired', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, ipAddress }),
          });

          if (!res.ok) {
            const text = await res.text();
            throw new Error(text || 'Failed to remove firewall rule');
          }

          const result = await res.json();
          alert(result.message);

          // Update the expired status in state
          setExpiredStatus(prev => ({
            ...prev,
            [name]: false
          }));

          fetchData();
        } catch (err) {
          alert('Error: ' + err.message);
        }
      }
    );
  };

  const filterUsers = () => {
    if (!searchTerm) return users;
    return users.filter(
      user =>
        user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.target &&
          user.target.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.profile &&
          user.profile.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  if (loading) return <div className="container mt-3">Loading...</div>;
  if (error)
    return (
      <div className="container mt-3 alert alert-danger">Error: {error}</div>
    );

  const filteredUsers = filterUsers();

  return (
    <div
      className="container p-4 shadow rounded"
      style={{
        background: 'linear-gradient(135deg,rgb(135, 184, 240) 0%,rgb(87, 96, 218) 100%)',
        color: 'white',
        boxShadow: '0 8px 24px rgba(37, 117, 252, 0.3)',
      }}
    >
      <h1 className="mb-4" style={{ fontWeight: '700' }}>
        User Management
      </h1>

      <div className="mb-4 d-flex flex-wrap gap-2">
        <button className="btn btn-light me-2 shadow-sm" onClick={fetchData}>
          Refresh Data
        </button>
        <button
          className="btn btn-light shadow-sm"
          onClick={() => setUploadVisible(!uploadVisible)}
        >
          {uploadVisible ? 'Hide details' : 'Show details'}
        </button>
      </div>

      <div
        className="mb-4 sticky-top p-3 rounded"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          backdropFilter: 'blur(10px)',
          zIndex: 1020,
        }}
      >
        <input
          type="text"
          className="form-control"
          placeholder="Search by name, IP or profile..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.3)',
            border: 'none',
            color: 'white',
          }}
        />
      </div>

      {filteredUsers.length === 0 ? (
        <div className="alert alert-info bg-light text-dark rounded">
          No users found
        </div>
      ) : (
        <div>
          {filteredUsers.map(user => (
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
              isExpired={expiredStatus[user.name] || false}
            />
          ))}
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

export default HomePage;