const express = require('express');
const path = require('path');
const { Client } = require('ssh2');
require('dotenv').config();

const app = express();
const port = 5000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// SSH command runner
function runSSHCommand(command) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let output = '';

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('close', () => {
          conn.end();
          resolve(output);
        }).on('data', (data) => {
          output += data.toString();
        }).stderr.on('data', (data) => {
          console.error('STDERR:', data.toString());
        });
      });
    }).on('error', (err) => {
      reject(err);
    }).connect({
      host: process.env.IP_ADDRESS,  
      port: 22,
      username: process.env.SSH_USERNAME,
      password: process.env.SSH_PASSWORD,
      readyTimeout: 5000,
    });
  });
}

function getActivePPPoENames() {
  return runSSHCommand('/ppp active print without-paging terse')
    .then(output => output
      .split('\n')
      .filter(line => line.includes('name='))
      .map(line => {
        const match = line.match(/name=([\S]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean)
    );
}

// ROUTES

app.get('/api/pppoe', async (req, res) => {
  try {
    const result = await runSSHCommand('/ppp active print');
    res.type('text/plain').send(result);
  } catch (err) {
    res.status(500).send('Failed to get PPPoE sessions: ' + err.message);
  }
});

app.get('/api/queues', async (req, res) => {
  try {
    const [queuesOutput, expiredOutput] = await Promise.all([
      runSSHCommand('/queue simple print without-paging terse where target~"192.168.99."'),
      runSSHCommand('/ip firewall address-list print where list="EXPIRED" without-paging terse')
    ]);

    // Get all expired IPs
    const expiredIps = expiredOutput.split('\n')
      .filter(line => line.includes('address='))
      .map(line => {
        const match = line.match(/address=([\S]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);

    // Parse queues
    const queues = queuesOutput.split('\n')
      .filter(line => line.trim().length > 0)
      .map(line => {
        const nameMatch = line.match(/name=([^ ]+)/);
        const targetMatch = line.match(/target=([^ ]+)/);
        const maxLimitMatch = line.match(/max-limit=([^ ]+)/);

        let download = '', upload = '';
        if (maxLimitMatch) {
          const parts = maxLimitMatch[1].split('/');
          download = parts[0] || '';
          upload = parts[1] || '';
        }

        const target = targetMatch ? targetMatch[1].replace('/32', '') : '';
        const expired = target && expiredIps.includes(target);

        return {
          name: nameMatch ? nameMatch[1] : '',
          target,
          download,
          upload,
          expired
        };
      });

    res.json(queues);
  } catch (err) {
    res.status(500).send('Failed to get queues: ' + err.message);
  }
});

app.post('/api/queues/update-rate', async (req, res) => {
  const { name, download, upload } = req.body;
  if (!name || !download || !upload) {
    return res.status(400).send('Missing name, download, or upload in request body');
  }

  try {
    const safeName = name.replace(/"/g, '\\"');
    const safeDownload = download.trim();
    const safeUpload = upload.trim();

    // Format max-limit for Mikrotik: "download/upload"
    const maxLimit = `${safeDownload}/${safeUpload}`;

    // MikroTik command to set max-limit by queue name
    const cmd = `/queue simple set max-limit=${maxLimit} [find name="${safeName}"]`;

    await runSSHCommand(cmd);

    res.json({ success: true, message: `Updated queue ${name} with max-limit ${maxLimit}` });
  } catch (err) {
    res.status(500).send('Failed to update queue rate: ' + err.message);
  }
});

app.get('/api/secrets', async (req, res) => {
  const profileFilter = req.query.profile;

  try {
    const [secretsOutput, activeNames] = await Promise.all([
      (async () => {
        let cmd = '/ppp secret print without-paging terse';
        if (profileFilter) {
          cmd = `/ppp secret print where profile="${profileFilter}"`;
        }
        return await runSSHCommand(cmd);
      })(),
      getActivePPPoENames(),
    ]);

    const secrets = secretsOutput
      .split('\n')
      .filter(line => line.includes('name=') && line.includes('profile='))
      .map(line => {
        const nameMatch = line.match(/name=([\S]+)/);
        const profileMatch = line.match(/profile=([\S]+)/);
        const name = nameMatch ? nameMatch[1] : '';
        return {
          name,
          profile: profileMatch ? profileMatch[1] : '',
          active: activeNames.includes(name),
        };
      });

    res.json(secrets);
  } catch (err) {
    res.status(500).send('Failed to get PPPoE secrets: ' + err.message);
  }
});

app.get('/api/profiles', async (req, res) => {
  try {
    const output = await runSSHCommand('/ppp profile print without-paging terse');
    const profiles = output
      .split('\n')
      .filter(line => line.includes('name='))
      .map(line => {
        const match = line.match(/name=([\S]+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    res.json(profiles);
  } catch (err) {
    res.status(500).send('Failed to get profiles: ' + err.message);
  }
});

app.post('/api/secrets/update-profile', async (req, res) => {
  const { name, profile } = req.body;
  if (!name || !profile) {
    return res.status(400).send('Missing name or profile in request body');
  }

  try {
    const safeName = name.replace(/"/g, '\\"');
    const safeProfile = profile.replace(/"/g, '\\"');

    // Update profile
    const updateCmd = `/ppp secret set profile="${safeProfile}" [find name="${safeName}"]`;
    await runSSHCommand(updateCmd);

    // Check if user is active
    const activeOutput = await runSSHCommand('/ppp active print terse');
    const isActive = activeOutput.includes(`name=${safeName}`);

    // If active, remove session
    if (isActive) {
      const removeCmd = `/ppp active remove [find name="${safeName}"]`;
      await runSSHCommand(removeCmd);
    }

    res.json({
      success: true,
      message: `Profile updated for ${name}${isActive ? ' and active session removed' : ''}`,
    });
  } catch (err) {
    res.status(500).send('Failed to update profile or remove session: ' + err.message);
  }
});

app.post('/api/firewall/add-expired', async (req, res) => {
  const { name, ipAddress } = req.body;
  if (!name || !ipAddress) {
    return res.status(400).send('Missing name or ipAddress in request body');
  }

  try {
    const safeName = name.replace(/"/g, '\\"');
    const safeIpAddress = ipAddress.replace(/"/g, '\\"');
    
    // Check if rule already exists
    const checkCmd = `/ip firewall address-list print where list="EXPIRED" and address="${safeIpAddress}"`;
    const existing = await runSSHCommand(checkCmd);
    
    if (existing.includes(safeIpAddress)) {
      return res.json({ success: true, message: `Firewall rule for ${ipAddress} already exists in EXPIRED list` });
    }

    // Add the rule if it doesn't exist
    const cmd = `/ip firewall address-list add list="EXPIRED" address="${safeIpAddress}" comment="${safeName}"`;
    await runSSHCommand(cmd);

    res.json({ success: true, message: `Added ${ipAddress} to EXPIRED firewall list with comment "${name}"` });
  } catch (err) {
    res.status(500).send('Failed to add firewall rule: ' + err.message);
  }
});

app.post('/api/firewall/remove-expired', async (req, res) => {
  const { ipAddress } = req.body;
  if (!ipAddress) {
    return res.status(400).send('Missing ipAddress in request body');
  }

  try {
    const safeIpAddress = ipAddress.replace(/"/g, '\\"');

    // Check if rule exists
    const checkCmd = `/ip firewall address-list print where list="EXPIRED" and address="${safeIpAddress}"`;
    const existing = await runSSHCommand(checkCmd);

    if (!existing.includes(safeIpAddress)) {
      return res.json({ success: false, message: `No firewall rule found for ${ipAddress} in EXPIRED list` });
    }

    // Remove the rule directly by find command (no need to parse rule number)
    const removeCmd = `/ip firewall address-list remove [find list="EXPIRED" and address="${safeIpAddress}"]`;
    await runSSHCommand(removeCmd);

    res.json({ success: true, message: `Removed ${ipAddress} from EXPIRED firewall list` });
  } catch (err) {
    res.status(500).send('Failed to remove firewall rule: ' + err.message);
  }
});

app.post('/api/firewall/add-expired', async (req, res) => {
  const { name, ipAddress } = req.body;
  if (!name || !ipAddress) {
    return res.status(400).send('Missing name or ipAddress in request body');
  }

  try {
    const safeName = name.replace(/"/g, '\\"');
    const safeIpAddress = ipAddress.replace(/"/g, '\\"');
    
    // Check if rule already exists
    const checkCmd = `/ip firewall address-list print where list="EXPIRED" and address="${safeIpAddress}"`;
    const existing = await runSSHCommand(checkCmd);
    
    if (existing.includes(safeIpAddress)) {
      return res.json({ success: true, message: `Firewall rule for ${ipAddress} already exists in EXPIRED list` });
    }

    // Add the rule if it doesn't exist
    const cmd = `/ip firewall address-list add list="EXPIRED" address="${safeIpAddress}" comment="${safeName}"`;
    await runSSHCommand(cmd);

    res.json({ success: true, message: `Added ${ipAddress} to EXPIRED firewall list with comment "${name}"` });
  } catch (err) {
    res.status(500).send('Failed to add firewall rule: ' + err.message);
  }
});

app.get('/api/firewall/expired-list', async (req, res) => {
  try {
    const cmd = `/ip firewall address-list print where list="EXPIRED"`;
    const result = await runSSHCommand(cmd);

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).send('Failed to retrieve EXPIRED firewall list: ' + err.message);
  }
});

app.get('/api/hotspot-profiles', async (req, res) => {
  try {
    const output = await runSSHCommand('/ip hotspot user profile print without-paging terse');

    const profiles = output
      .split('\n')
      .filter(line => line.includes('name='))
      .map(line => {
        const match = line.match(/name=([^\s]+)/); // Match name up to first space
        return match ? match[1] : null;
      })
      .filter(Boolean);

    res.json(profiles);
  } catch (err) {
    res.status(500).send('Failed to get Hotspot profiles: ' + err.message);
  }
});

app.post('/add-user', async (req, res) => {
  const { username, password, profile, uptime } = req.body;

  // Build the base command
  let command = `/ip hotspot user add name=${username} profile=${profile} limit-uptime=${uptime}`;

  // Add password only if provided
  if (password && password.trim() !== '') {
    command += ` password=${password}`;
  }

  try {
    const result = await runSSHCommand(command);
    res.send(`<h3>User "${username}" added successfully!</h3><a href="/">← Back</a>`);
  } catch (error) {
    console.error(error);
    res.send(`<h3>Error adding user:</h3><pre>${error.message}</pre><a href="/">← Back</a>`);
  }
});

app.post('/add-pppoe-user', async (req, res) => {
  const { username, password, profile } = req.body;
  const command = `/ppp secret add name=${username} password=${password} profile=${profile} service=pppoe`;

  try {
    const result = await runSSHCommand(command);
    res.send(`PPPoE user "${username}" added.`);
  } catch (error) {
    res.status(500).send('Error: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});