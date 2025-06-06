import React, { useEffect, useState } from 'react';

function HotspotVendo() {
  const [hotspotProfiles, setHotspotProfiles] = useState([]);
  const [pppoeProfiles, setPppoeProfiles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('hotspot');
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);

  const [hotspotData, setHotspotData] = useState({
    username: '',
    password: '',
    profile: 'Vendo',
    hours: '',
    minutes: '',
  });

  const [pppoeData, setPppoeData] = useState({
    username: '',
    password: '',
    profile: '',
  });

  // Update isMobile on resize
  useEffect(() => {
    function handleResize() {
      setIsMobile(window.innerWidth <= 480);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Fetch hotspot profiles
        const hotspotRes = await fetch('/api/hotspot-profiles');
        const hotspotData = await hotspotRes.json();
        setHotspotProfiles(hotspotData);

        // Fetch PPPoE profiles
        const pppoeRes = await fetch('/api/profiles');
        const pppoeData = await pppoeRes.json();
        setPppoeProfiles(pppoeData);
      } catch (err) {
        console.error('Failed to load profiles:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleHotspotChange = (e) => {
    const { name, value } = e.target;
    setHotspotData(prev => ({ ...prev, [name]: value }));
  };

  const handlePppoeChange = (e) => {
    const { name, value } = e.target;
    setPppoeData(prev => ({ ...prev, [name]: value }));
  };

  const handleHotspotSubmit = async (e) => {
    e.preventDefault();
    const uptime = `${hotspotData.hours || 0}h${hotspotData.minutes || 0}m`;

    const payload = {
      username: hotspotData.username,
      password: hotspotData.password,
      profile: hotspotData.profile,
      uptime,
    };

    try {
      const res = await fetch('/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Hotspot user added successfully');
        setHotspotData({
          username: '',
          password: '',
          profile: '',
          hours: '',
          minutes: '',
        });
      } else {
        const errorText = await res.text();
        throw new Error(errorText);
      }
    } catch (err) {
      alert(`Failed to add user: ${err.message}`);
    }
  };

  const handlePppoeSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      username: pppoeData.username,
      password: pppoeData.password,
      profile: pppoeData.profile,
    };

    try {
      const res = await fetch('/add-pppoe-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('PPPoE user added successfully');
        setPppoeData({
          username: '',
          password: '',
          profile: '',
        });
      } else {
        const errorText = await res.text();
        throw new Error(errorText);
      }
    } catch (err) {
      alert(`Failed to add PPPoE user: ${err.message}`);
    }
  };

  // Responsive styles overrides
  const responsiveTimeInputContainer = {
    ...styles.timeInputContainer,
    flexDirection: isMobile ? 'column' : 'row',
    alignItems: isMobile ? 'stretch' : 'center',
  };

  const responsiveTimeInput = {
    ...styles.timeInput,
    width: isMobile ? '100%' : '80px',
    marginLeft: 0,
    marginBottom: isMobile ? '12px' : 0,
  };

  const responsiveTimeLabel = {
    ...styles.timeLabel,
    marginLeft: '15px',
    marginRight: isMobile ? 0 : '25px',
    marginBottom: isMobile ? '12px' : 0,
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Network User Management</h1>
      </div>

      <div style={styles.tabContainer}>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'hotspot' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('hotspot')}
        >
          Hotspot User
        </button>
        <button
          style={{
            ...styles.tabButton,
            ...(activeTab === 'pppoe' ? styles.activeTab : {})
          }}
          onClick={() => setActiveTab('pppoe')}
        >
          PPPoE User
        </button>
      </div>

      {isLoading ? (
        <div style={styles.loading}>Loading profiles...</div>
      ) : (
        <>
          {activeTab === 'hotspot' && (
            <div style={styles.formContainer}>
              <h2 style={styles.formTitle}>Create Hotspot User</h2>
              <form onSubmit={handleHotspotSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={hotspotData.username}
                    onChange={handleHotspotChange}
                    required
                    style={styles.input}
                    placeholder="Enter username"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Password (optional)
                  </label>
                  <input
                    type="text"
                    name="password"
                    value={hotspotData.password}
                    onChange={handleHotspotChange}
                    style={styles.input}
                    placeholder="Enter password"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Profile
                  </label>
                  <select
                    name="profile"
                    value={hotspotData.profile}
                    onChange={handleHotspotChange}
                    required
                    style={styles.select}
                  >
                    <option value="" disabled>Select a profile</option>
                    {hotspotProfiles.map((profile, index) => (
                      <option key={index} value={profile}>{profile}</option>
                    ))}
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Uptime Limit
                  </label>
                  <div style={responsiveTimeInputContainer}>
                    <input
                      type="number"
                      name="hours"
                      placeholder="0"
                      value={hotspotData.hours}
                      onChange={handleHotspotChange}
                      min="0"
                      style={responsiveTimeInput}
                    />
                    <span style={responsiveTimeLabel}>hours</span>
                    <input
                      type="number"
                      name="minutes"
                      placeholder="0"
                      value={hotspotData.minutes}
                      onChange={handleHotspotChange}
                      min="0"
                      max="59"
                      style={responsiveTimeInput}
                    />
                    <span style={responsiveTimeLabel}>minutes</span>
                  </div>
                </div>

                <button type="submit" style={styles.submitButton}>
                  Create Hotspot User
                </button>
              </form>
            </div>
          )}

          {activeTab === 'pppoe' && (
            <div style={styles.formContainer}>
              <h2 style={styles.formTitle}>Create PPPoE User</h2>
              <form onSubmit={handlePppoeSubmit} style={styles.form}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={pppoeData.username}
                    onChange={handlePppoeChange}
                    required
                    style={styles.input}
                    placeholder="Enter username"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Password
                  </label>
                  <input
                    type="text"
                    name="password"
                    value={pppoeData.password}
                    onChange={handlePppoeChange}
                    required
                    style={styles.input}
                    placeholder="Enter password"
                  />
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>
                    Profile
                  </label>
                  <select
                    name="profile"
                    value={pppoeData.profile}
                    onChange={handlePppoeChange}
                    required
                    style={styles.select}
                  >
                    <option value="" disabled>Select a profile</option>
                    {pppoeProfiles.map((profile, index) => (
                      <option key={index} value={profile}>{profile}</option>
                    ))}
                  </select>
                </div>

                <button type="submit" style={styles.submitButton}>
                  Create PPPoE User
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: '800px',
    margin: 'auto',
    padding: '40px 50px',
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    background: 'linear-gradient(135deg, #4b6cb7 0%, #182848 100%)',
    borderRadius: '16px',
    boxShadow: '0 12px 30px rgba(24, 40, 72, 0.6)',
    color: '#f0f4ff',
  },
  header: {
    textAlign: 'center',
    marginBottom: '40px',
  },
  title: {
    color: '#e3eafc',
    fontWeight: '800',
    fontSize: '2.6rem',
    letterSpacing: '2px',
    marginBottom: '8px',
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },
  tabContainer: {
    display: 'flex',
    marginBottom: '40px',
    borderBottom: '3px solid #294e9b',
    userSelect: 'none',
  },
  tabButton: {
    flex: 1,
    padding: '14px 0',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    fontWeight: '700',
    color: '#aab8d4',
    letterSpacing: '0.8px',
    transition: 'color 0.4s ease, border-bottom-color 0.4s ease',
    outline: 'none',
  },
  activeTab: {
    color: '#ffd369',
    borderBottom: '4px solid #ffd369',
    fontWeight: '800',
    textShadow: '0 0 6px #ffd369',
  },
  formContainer: {
    backgroundColor: '#f9fbff',
    padding: '40px 45px',
    borderRadius: '16px',
    boxShadow: '0 8px 25px rgba(41, 98, 255, 0.2)',
    color: '#182848',
  },
  formTitle: {
    color: '#182848',
    marginBottom: '35px',
    textAlign: 'center',
    fontSize: '2rem',
    fontWeight: '800',
    letterSpacing: '1px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  formGroup: {
    marginBottom: '28px',
  },
  label: {
    display: 'block',
    marginBottom: '12px',
    fontWeight: '700',
    color: '#3b4a65',
    fontSize: '1.1rem',
  },
  input: {
    width: '100%',
    padding: '16px 18px',
    border: '2px solid #c4d0f0',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#182848',
    transition: 'border-color 0.35s ease, box-shadow 0.35s ease',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.03)',
  },
  select: {
    width: '100%',
    padding: '16px 18px',
    border: '2px solid #c4d0f0',
    borderRadius: '8px',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#182848',
    backgroundColor: '#fff',
    boxShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.03)',
    cursor: 'pointer',
  },
  submitButton: {
    padding: '18px 30px',
    fontSize: '1.3rem',
    fontWeight: '700',
    backgroundColor: '#3055ff',
    border: 'none',
    borderRadius: '12px',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 0 25px #3055ff',
    transition: 'background-color 0.4s ease',
  },
  timeInputContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  timeInput: {
    width: '80px',
    padding: '12px 16px',
    marginLeft: '10px',
    borderRadius: '6px',
    border: '2px solid #c4d0f0',
    fontSize: '1.1rem',
    fontWeight: '600',
    color: '#182848',
  },
  timeLabel: {
    marginLeft: '25px',
    fontWeight: '600',
    fontSize: '1.1rem',
    color: '#182848',
  },
  loading: {
    textAlign: 'center',
    fontSize: '1.3rem',
    color: '#c0c5d9',
    marginTop: '60px',
  },
};

export default HotspotVendo;
