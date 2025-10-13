# Sudo Quick Start

## For Impatient People

### Option 1: Development (Quick & Dirty)

```bash
# Just run as root
sudo npm start
```

Done. Not secure. Don't use in production.

---

### Option 2: Production (Proper Way)

```bash
# 1. Create service user
sudo useradd -r -s /bin/bash -d /opt/claude-monitor -m claude-monitor

# 2. Configure sudo
sudo visudo -f /etc/sudoers.d/claude-monitor
```

Add this (replace user1,user2,user3 with real usernames):
```
User_Alias CLAUDE_USERS = user1, user2, user3
Cmnd_Alias CLAUDE_CMDS = /bin/bash, /bin/cp, /bin/chown
claude-monitor ALL=(CLAUDE_USERS) NOPASSWD: CLAUDE_CMDS
```

```bash
# 3. Test it
sudo -u claude-monitor sudo -u user1 bash -c 'whoami'
# Should print: user1

# 4. Run app as service user
sudo -u claude-monitor npm start
```

Done.

---

See SUDO_SETUP.md for details, security info, and troubleshooting.
