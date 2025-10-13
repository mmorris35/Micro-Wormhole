#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log('═══════════════════════════════════════════');
    console.log(' Claude Code Monitor - Service Installer');
    console.log('═══════════════════════════════════════════\n');

    // Check if running as root
    if (process.getuid && process.getuid() !== 0) {
        console.error('ERROR: This script must be run as root (use sudo)');
        process.exit(1);
    }

    // Get installation options
    console.log('Installation Options:\n');

    const installDir = await question('Installation directory [/opt/claude-monitor]: ') || '/opt/claude-monitor';
    const serviceUser = await question('Service user [claude-monitor]: ') || 'claude-monitor';
    const serviceGroup = await question('Service group [claude-monitor]: ') || 'claude-monitor';

    console.log('\nConfiguration:');
    console.log(`  Install directory: ${installDir}`);
    console.log(`  Service user: ${serviceUser}`);
    console.log(`  Service group: ${serviceGroup}`);

    const confirm = await question('\nProceed with installation? (yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
        console.log('Installation cancelled');
        rl.close();
        process.exit(0);
    }

    try {
        // Create service user if doesn't exist
        console.log(`\n[1/6] Creating service user: ${serviceUser}`);
        try {
            execSync(`id ${serviceUser}`, { stdio: 'ignore' });
            console.log(`  User ${serviceUser} already exists`);
        } catch {
            execSync(`useradd -r -s /bin/bash -d ${installDir} -m ${serviceUser}`);
            console.log(`  Created user: ${serviceUser}`);
        }

        // Create installation directory
        console.log(`\n[2/6] Creating installation directory: ${installDir}`);
        if (!fs.existsSync(installDir)) {
            fs.mkdirSync(installDir, { recursive: true });
        }

        const appDir = `${installDir}/claude-code-monitor`;

        // Copy application files
        console.log('\n[3/6] Copying application files...');
        const currentDir = process.cwd();
        execSync(`cp -r ${currentDir} ${appDir}`);

        // Set ownership
        console.log('\n[4/6] Setting file ownership...');
        execSync(`chown -R ${serviceUser}:${serviceGroup} ${appDir}`);

        // Install systemd service
        console.log('\n[5/6] Installing systemd service...');

        // Update service file with actual paths
        let serviceContent = fs.readFileSync('claude-monitor.service', 'utf8');
        serviceContent = serviceContent
            .replace(/User=.+/, `User=${serviceUser}`)
            .replace(/Group=.+/, `Group=${serviceGroup}`)
            .replace(/WorkingDirectory=.+/, `WorkingDirectory=${appDir}`)
            .replace(/EnvironmentFile=.+/, `EnvironmentFile=${appDir}/.env`);

        fs.writeFileSync('/etc/systemd/system/claude-monitor.service', serviceContent);

        // Reload systemd
        execSync('systemctl daemon-reload');

        console.log('\n[6/6] Installation complete!');
        console.log('\nNext steps:');
        console.log(`  1. Configure environment: nano ${appDir}/.env`);
        console.log('  2. Configure sudo: See SUDO_SETUP.md');
        console.log('  3. Enable service: systemctl enable claude-monitor');
        console.log('  4. Start service: systemctl start claude-monitor');
        console.log('  5. Check status: systemctl status claude-monitor');
        console.log('  6. View logs: journalctl -u claude-monitor -f\n');

    } catch (error) {
        console.error('\nInstallation failed:', error.message);
        process.exit(1);
    }

    rl.close();
}

main();
