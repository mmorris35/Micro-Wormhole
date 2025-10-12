# Phase 5: File Upload System

**Branch**: `phase-5-file-upload`
**Duration**: ~5 hours
**Prerequisites**: Phase 4 completed

## Phase Objectives
- Setup multer file upload endpoint
- Implement file copy to session directory with correct ownership
- Add drag-and-drop functionality
- Implement paste upload (including iOS support)
- Create upload progress indicator
- Handle upload errors and validation

## Phase Completion Criteria
- [ ] POST /api/upload/:sessionId endpoint works
- [ ] Files upload successfully via button, drag-drop, and paste
- [ ] Files copied to session working directory
- [ ] File ownership set to session user
- [ ] Upload progress indicator displays
- [ ] File size limit enforced (100MB)
- [ ] Error handling functional
- [ ] iOS paste support works
- [ ] All task branches merged to `phase-5-file-upload`
- [ ] Phase branch ready to merge to `main`

---

## Task 5.1: Setup Multer File Upload Endpoint

**Branch**: `phase-5/task-5.1-multer-endpoint`
**Estimated Time**: 1 hour

### Subtasks

#### 5.1.1: Configure multer middleware
**Action**: Add to `server.js` after other middleware:

```javascript
const multer = require('multer');
const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

// Ensure uploads directory exists
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    logger.info(`Created uploads directory: ${UPLOAD_DIR}`);
}

// Configure multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOAD_DIR);
    },
    filename: (req, file, cb) => {
        // Generate unique filename: timestamp-uuid-originalname
        const uniqueSuffix = Date.now() + '-' + crypto.randomUUID();
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.UPLOAD_MAX_FILE_SIZE) || 104857600 // 100MB
    },
    fileFilter: (req, file, cb) => {
        // Accept all file types
        cb(null, true);
    }
});
```

**Completion Criteria**:
- multer configured with disk storage
- Uploads directory created if missing
- Unique filenames generated
- 100MB file size limit set
- All file types accepted

#### 5.1.2: Create upload endpoint
**Action**: Add to `server.js` before 404 handler:

```javascript
// File upload endpoint
app.post('/api/upload/:sessionId', upload.single('file'), async (req, res) => {
    const { sessionId } = req.params;
    const file = req.file;

    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        // Get session from database
        const session = sessionsDb.getSession(sessionId);
        if (!session) {
            // Clean up uploaded file
            fs.unlinkSync(file.path);
            return res.status(404).json({ error: 'Session not found' });
        }

        // Destination path in session working directory
        const destPath = path.join(session.working_directory, file.originalname);
        const tempPath = file.path;

        logger.info(`Uploading file to session ${sessionId}: ${file.originalname}`);

        // Copy file to session directory and set ownership
        // Phase 6 will add sudo support for different users
        // For now, just copy the file
        fs.copyFileSync(tempPath, destPath);

        // Clean up temp file
        fs.unlinkSync(tempPath);

        logger.info(`File uploaded successfully: ${destPath}`);

        // Emit event to connected clients
        io.to(sessionId).emit('file:uploaded', {
            sessionId,
            filename: file.originalname,
            path: destPath
        });

        res.json({
            success: true,
            filename: file.originalname,
            path: destPath
        });

    } catch (error) {
        logger.error(`File upload failed for session ${sessionId}:`, error);

        // Clean up temp file if it exists
        if (file && file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        res.status(500).json({ error: error.message });
    }
});

// Handle multer errors
app.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File too large (max 100MB)' });
        }
        return res.status(400).json({ error: error.message });
    }
    next(error);
});
```

**Completion Criteria**:
- POST /api/upload/:sessionId endpoint created
- Single file upload handled
- Session validation performed
- File copied to working directory
- Temp file cleaned up
- Socket.io event emitted
- Multer errors handled
- File size limit enforced

#### 5.1.3: Add crypto import
**Action**: Add to top of `server.js`:

```javascript
const crypto = require('crypto');
```

**Completion Criteria**:
- crypto imported for UUID generation

#### 5.1.4: Test upload endpoint
**Commands**:
```bash
# Start server
npm start

# Create a test session first (use frontend or API)
# Then test file upload:

# Create test file
echo "test content" > /tmp/testfile.txt

# Upload file (replace SESSION_ID)
curl -X POST http://localhost:3456/api/upload/SESSION_ID \
  -F "file=@/tmp/testfile.txt"

# Clean up
rm /tmp/testfile.txt
```

**Expected output**:
```json
{
  "success": true,
  "filename": "testfile.txt",
  "path": "/path/to/working/dir/testfile.txt"
}
```

**Completion Criteria**:
- File uploads successfully
- Response includes filename and path
- File exists in destination
- Temp file removed
- Socket.io event logged

#### 5.1.5: Test file size limit
**Commands**:
```bash
# Create file larger than 100MB
dd if=/dev/zero of=/tmp/large.bin bs=1M count=101

# Try to upload (should fail)
curl -X POST http://localhost:3456/api/upload/SESSION_ID \
  -F "file=@/tmp/large.bin"

# Clean up
rm /tmp/large.bin
```

**Expected**: Error response with "File too large" message

**Completion Criteria**:
- Upload rejected for files >100MB
- Error message returned

#### 5.1.6: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 5.1 Quality Gates
- [ ] Multer configured correctly
- [ ] Upload endpoint functional
- [ ] Files copied to correct directory
- [ ] Temp files cleaned up
- [ ] File size limit enforced
- [ ] Error handling works
- [ ] ESLint passes

### Task 5.1 Completion
```bash
git add server.js
git commit -m "Task 5.1: Setup multer file upload endpoint"
git checkout phase-5-file-upload
git merge phase-5/task-5.1-multer-endpoint --squash
git commit -m "Task 5.1: Setup multer file upload endpoint

- Configured multer with disk storage
- Created POST /api/upload/:sessionId endpoint
- Implemented file copy to session directory
- Added cleanup of temp files
- Enforced 100MB file size limit
- Added multer error handling
- Quality gates passed"
```

---

## Task 5.2: Implement File Copy with Sudo (Placeholder for Phase 6)

**Branch**: `phase-5/task-5.2-sudo-copy`
**Estimated Time**: 30 minutes

### Subtasks

#### 5.2.1: Add helper function for file copy with ownership
**Action**: Add to `server.js` (will be enhanced in Phase 6):

```javascript
/**
 * Copy file to destination with correct ownership
 * Phase 6 will add sudo support for different users
 */
async function copyFileToSession(sourcePath, destPath, runAsUser) {
    try {
        // Phase 5: Simple copy (current user only)
        fs.copyFileSync(sourcePath, destPath);
        logger.info(`File copied: ${destPath}`);

        // Phase 6 will add:
        // - sudo cp ${sourcePath} ${destPath}
        // - sudo chown ${runAsUser}:${runAsUser} ${destPath}

        return true;
    } catch (error) {
        logger.error('File copy failed:', error);
        throw error;
    }
}
```

**Completion Criteria**:
- Helper function created
- Simple copy implemented
- Comments note Phase 6 enhancements
- Error handling included

#### 5.2.2: Update upload endpoint to use helper
**Action**: Replace fs.copyFileSync in upload endpoint with:

```javascript
        // Copy file to session directory and set ownership
        await copyFileToSession(tempPath, destPath, session.run_as_user);
```

**Completion Criteria**:
- Upload endpoint uses helper function
- Ready for Phase 6 sudo integration

#### 5.2.3: Run ESLint
**Command**:
```bash
npm run lint server.js
```

**Completion Criteria**:
- ESLint passes

### Task 5.2 Quality Gates
- [ ] Helper function created
- [ ] Upload endpoint updated
- [ ] File copy works
- [ ] Ready for Phase 6 enhancement
- [ ] ESLint passes

### Task 5.2 Completion
```bash
git add server.js
git commit -m "Task 5.2: Add file copy helper (Phase 6 ready)"
git checkout phase-5-file-upload
git merge phase-5/task-5.2-sudo-copy --squash
git commit -m "Task 5.2: Add file copy helper function

- Created copyFileToSession helper
- Prepared for Phase 6 sudo integration
- Updated upload endpoint to use helper
- Quality gates passed"
```

---

## Task 5.3: Add Drag-and-Drop UI

**Branch**: `phase-5/task-5.3-drag-drop`
**Estimated Time**: 1 hour

### Subtasks

#### 5.3.1: Implement drag-and-drop handlers
**Action**: Already implemented in `public/app.js` from Phase 4, but verify:

```javascript
// In setupEventListeners()

// Drag and drop
terminalContainer.addEventListener('dragover', (e) => {
    e.preventDefault();
    if (currentSessionId) {
        dropOverlay.classList.remove('hidden');
    }
});

terminalContainer.addEventListener('dragleave', (e) => {
    if (e.target === terminalContainer) {
        dropOverlay.classList.add('hidden');
    }
});

terminalContainer.addEventListener('drop', (e) => {
    e.preventDefault();
    dropOverlay.classList.add('hidden');

    if (currentSessionId && e.dataTransfer.files.length > 0) {
        uploadFiles(Array.from(e.dataTransfer.files));
    }
});
```

**Completion Criteria**:
- Drag-and-drop handlers present
- Drop overlay shows/hides correctly
- Files extracted from dataTransfer

#### 5.3.2: Implement uploadFiles() function
**Action**: Add to `public/app.js`:

```javascript
async function uploadFiles(files) {
    if (!currentSessionId) {
        alert('No active session');
        return;
    }

    if (files.length === 0) {
        return;
    }

    // Show progress
    uploadProgress.classList.remove('hidden');
    uploadProgressFill.style.width = '0%';
    uploadProgressText.textContent = `Uploading ${files.length} file(s)...`;

    let completed = 0;

    for (const file of files) {
        try {
            await uploadFile(file);
            completed++;

            // Update progress
            const percent = Math.round((completed / files.length) * 100);
            uploadProgressFill.style.width = percent + '%';
            uploadProgressText.textContent = `Uploaded ${completed}/${files.length} files`;

        } catch (error) {
            console.error('Upload failed:', error);
            alert(`Failed to upload ${file.name}: ${error.message}`);
        }
    }

    // Hide progress after delay
    setTimeout(() => {
        uploadProgress.classList.add('hidden');
    }, 2000);
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`/api/upload/${currentSessionId}`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
    }

    return await response.json();
}
```

**Completion Criteria**:
- uploadFiles() handles multiple files
- Progress indicator updates
- uploadFile() sends fetch request
- Errors handled and displayed
- Progress hidden after completion

#### 5.3.3: Test drag-and-drop
**Manual test**:
1. Start server and open browser
2. Create/attach to session
3. Drag file from desktop onto terminal area
4. Verify drop overlay appears
5. Drop file
6. Verify progress indicator shows
7. Check terminal for upload confirmation
8. Verify file exists in session directory

**Completion Criteria**:
- Drag-and-drop works
- Progress indicator displays
- Files uploaded successfully

#### 5.3.4: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 5.3 Quality Gates
- [ ] Drag-and-drop handlers implemented
- [ ] uploadFiles() function works
- [ ] Progress indicator functional
- [ ] Multiple files supported
- [ ] Error handling works
- [ ] ESLint passes

### Task 5.3 Completion
```bash
git add public/app.js
git commit -m "Task 5.3: Add drag-and-drop UI"
git checkout phase-5-file-upload
git merge phase-5/task-5.3-drag-drop --squash
git commit -m "Task 5.3: Add drag-and-drop UI

- Implemented drag-and-drop event handlers
- Created uploadFiles() function
- Added uploadFile() with fetch API
- Implemented progress indicator
- Tested drag-and-drop functionality
- Quality gates passed"
```

---

## Task 5.4: Implement Paste Upload Handler

**Branch**: `phase-5/task-5.4-paste-upload`
**Estimated Time**: 1 hour

### Subtasks

#### 5.4.1: Implement paste event handler
**Action**: Already partially in `public/app.js` from Phase 4, complete it:

```javascript
// In setupEventListeners()

// Paste handler for iOS and desktop
document.addEventListener('paste', async (e) => {
    if (!currentSessionId) return;

    const items = e.clipboardData.items;
    const files = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Handle files
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        }
    }

    if (files.length > 0) {
        e.preventDefault();
        uploadFiles(files);
    }
});
```

**Completion Criteria**:
- Paste event listener added
- Clipboard items extracted
- Files identified and uploaded
- Event prevented if files found

#### 5.4.2: Add iOS-specific paste support
**Action**: Add to `public/app.js`:

```javascript
// iOS Safari specific paste handling
// iOS requires input element to receive paste
const pasteInput = document.createElement('textarea');
pasteInput.style.position = 'absolute';
pasteInput.style.left = '-9999px';
pasteInput.style.opacity = '0';
pasteInput.setAttribute('aria-hidden', 'true');
document.body.appendChild(pasteInput);

// Focus paste input when needed (e.g., on button click)
document.getElementById('paste-trigger')?.addEventListener('click', () => {
    pasteInput.focus();
});

// Handle paste in hidden input
pasteInput.addEventListener('paste', async (e) => {
    if (!currentSessionId) return;

    const items = e.clipboardData.items;
    const files = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
                files.push(file);
            }
        }
    }

    if (files.length > 0) {
        e.preventDefault();
        uploadFiles(files);
        // Return focus to terminal
        terminal.focus();
    }
});
```

**Completion Criteria**:
- Hidden textarea for iOS created
- iOS paste handling implemented
- Focus management added

#### 5.4.3: Add paste button to UI (optional for iOS)
**Action**: Optionally add button to HTML in `public/index.html`:

```html
<!-- In terminal-actions div, after upload button -->
<button id="paste-trigger" class="btn-secondary" disabled>
    Paste File
</button>
```

And enable/disable in attachToSession/detachSession:
```javascript
// In attachToSession()
document.getElementById('paste-trigger')?.removeAttribute('disabled');

// In detachSession()
document.getElementById('paste-trigger')?.setAttribute('disabled', 'disabled');
```

**Note**: This is optional - paste works without button on most platforms

**Completion Criteria**:
- Optional paste button added
- Button enabled/disabled with session

#### 5.4.4: Test paste upload
**Manual test**:
1. Create test file
2. Open file in image viewer or text editor
3. Copy contents (Cmd+C / Ctrl+C)
4. Go to browser with active session
5. Paste (Cmd+V / Ctrl+V)
6. Verify upload progress shows
7. Check file uploaded

**iOS test** (if available):
1. Take screenshot on iOS
2. Open app in Safari
3. Tap paste button (if added)
4. Paste screenshot
5. Verify upload

**Completion Criteria**:
- Paste works on desktop
- Paste works on iOS (if tested)
- Files uploaded successfully

#### 5.4.5: Run ESLint
**Command**:
```bash
npm run lint public/app.js public/index.html
```

**Completion Criteria**:
- ESLint passes

### Task 5.4 Quality Gates
- [ ] Paste event handler implemented
- [ ] iOS-specific handling added
- [ ] Optional paste button added
- [ ] Paste tested on desktop
- [ ] Paste tested on iOS (if available)
- [ ] ESLint passes

### Task 5.4 Completion
```bash
git add public/app.js public/index.html
git commit -m "Task 5.4: Implement paste upload handler"
git checkout phase-5-file-upload
git merge phase-5/task-5.4-paste-upload --squash
git commit -m "Task 5.4: Implement paste upload handler

- Implemented paste event handler
- Added iOS-specific paste support
- Created hidden textarea for iOS Safari
- Added optional paste button
- Tested paste upload on desktop
- Quality gates passed"
```

---

## Task 5.5: Create Upload Progress UI

**Branch**: `phase-5/task-5.5-upload-progress`
**Estimated Time**: 30 minutes

### Subtasks

#### 5.5.1: Verify progress UI elements exist
**Action**: Check `public/index.html` has:

```html
<div id="upload-progress" class="upload-progress hidden">
    <div class="upload-progress-bar">
        <div class="upload-progress-fill"></div>
    </div>
    <div class="upload-progress-text">Uploading...</div>
</div>
```

**Completion Criteria**:
- Progress UI elements present in HTML

#### 5.5.2: Verify progress CSS styling
**Action**: Check `public/style.css` has upload-progress styles

**Completion Criteria**:
- Progress UI styled correctly
- Fixed position bottom-right
- Hidden by default

#### 5.5.3: Enhance uploadFiles() with better progress
**Action**: Update uploadFiles() in `public/app.js`:

```javascript
async function uploadFiles(files) {
    if (!currentSessionId) {
        alert('No active session');
        return;
    }

    if (files.length === 0) {
        return;
    }

    // Show progress
    uploadProgress.classList.remove('hidden');
    uploadProgressFill.style.width = '0%';

    let completed = 0;
    const total = files.length;

    for (const file of files) {
        uploadProgressText.textContent = `Uploading ${file.name} (${completed + 1}/${total})...`;

        try {
            await uploadFile(file);
            completed++;

            // Update progress
            const percent = Math.round((completed / total) * 100);
            uploadProgressFill.style.width = percent + '%';

        } catch (error) {
            console.error('Upload failed:', error);
            uploadProgressText.textContent = `Failed: ${file.name}`;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }

    // Show completion
    uploadProgressText.textContent = `Uploaded ${completed}/${total} file(s) successfully`;

    // Hide progress after delay
    setTimeout(() => {
        uploadProgress.classList.add('hidden');
        uploadProgressFill.style.width = '0%';
    }, 2000);
}
```

**Completion Criteria**:
- Progress shows current file name
- Progress bar animates
- Completion message shown
- Auto-hides after 2 seconds

#### 5.5.4: Test progress indicator
**Manual test**:
1. Upload single file - verify progress shows
2. Upload multiple files - verify progress updates per file
3. Upload large file - verify progress bar animates
4. Verify auto-hide after completion

**Completion Criteria**:
- Progress indicator works for all upload methods
- Updates correctly
- Auto-hides

#### 5.5.5: Run ESLint
**Command**:
```bash
npm run lint public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 5.5 Quality Gates
- [ ] Progress UI elements verified
- [ ] Progress styling correct
- [ ] uploadFiles() enhanced
- [ ] Progress tested
- [ ] ESLint passes

### Task 5.5 Completion
```bash
git add public/app.js
git commit -m "Task 5.5: Enhance upload progress UI"
git checkout phase-5-file-upload
git merge phase-5/task-5.5-upload-progress --squash
git commit -m "Task 5.5: Enhance upload progress UI

- Verified progress UI elements
- Enhanced uploadFiles() with better feedback
- Added current file name to progress
- Tested progress indicator
- Quality gates passed"
```

---

## Task 5.6: Add Error Handling and Validation

**Branch**: `phase-5/task-5.6-error-handling`
**Estimated Time**: 1 hour

### Subtasks

#### 5.6.1: Add file upload button handler
**Action**: Add to setupEventListeners() in `public/app.js`:

```javascript
// File upload button handler
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0 && currentSessionId) {
        const files = Array.from(e.target.files);
        uploadFiles(files);
    }
    fileInput.value = ''; // Reset input to allow same file again
});
```

**Completion Criteria**:
- Upload button handler added
- File input reset after upload

#### 5.6.2: Add client-side validation
**Action**: Update uploadFiles() with validation:

```javascript
async function uploadFiles(files) {
    if (!currentSessionId) {
        alert('No active session selected');
        return;
    }

    if (files.length === 0) {
        return;
    }

    // Validate file sizes
    const maxSize = 104857600; // 100MB
    const oversized = files.filter(f => f.size > maxSize);

    if (oversized.length > 0) {
        alert(`The following files exceed 100MB limit:\n${oversized.map(f => f.name).join('\n')}`);
        return;
    }

    // Validate total upload size
    const totalSize = files.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > maxSize * 5) { // Max 500MB total
        alert('Total upload size exceeds limit (500MB)');
        return;
    }

    // ... rest of upload logic
}
```

**Completion Criteria**:
- File size validation added
- Total upload size limited
- User-friendly error messages

#### 5.6.3: Improve error handling in uploadFile()
**Action**: Update uploadFile() function:

```javascript
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    let response;
    try {
        response = await fetch(`/api/upload/${currentSessionId}`, {
            method: 'POST',
            body: formData
        });
    } catch (error) {
        throw new Error(`Network error: ${error.message}`);
    }

    if (!response.ok) {
        let errorMsg = 'Upload failed';
        try {
            const error = await response.json();
            errorMsg = error.error || errorMsg;
        } catch (e) {
            errorMsg = `HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMsg);
    }

    return await response.json();
}
```

**Completion Criteria**:
- Network error handling improved
- HTTP error messages parsed
- Fallback error messages provided

#### 5.6.4: Add server-side validation
**Action**: Update upload endpoint in `server.js`:

```javascript
// File upload endpoint (enhanced validation)
app.post('/api/upload/:sessionId', upload.single('file'), async (req, res) => {
    const { sessionId } = req.params;
    const file = req.file;

    // Validation
    if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    if (!sessionId) {
        fs.unlinkSync(file.path);
        return res.status(400).json({ error: 'Session ID required' });
    }

    try {
        // Get session from database
        const session = sessionsDb.getSession(sessionId);
        if (!session) {
            fs.unlinkSync(file.path);
            return res.status(404).json({ error: 'Session not found' });
        }

        // Validate session is running
        if (session.status !== 'running') {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Session is not running' });
        }

        // Validate working directory exists
        if (!fs.existsSync(session.working_directory)) {
            fs.unlinkSync(file.path);
            return res.status(400).json({ error: 'Session working directory not found' });
        }

        // ... rest of upload logic
    } catch (error) {
        // ... error handling
    }
});
```

**Completion Criteria**:
- Session validation enhanced
- Session status checked
- Working directory validated
- Proper cleanup on errors

#### 5.6.5: Test error scenarios
**Manual test**:
1. Upload without session - should show error
2. Upload file >100MB - should be rejected
3. Upload to non-existent session - should show error
4. Upload to stopped session - should show error
5. Disconnect network and upload - should handle gracefully

**Completion Criteria**:
- All error scenarios handled
- User-friendly messages shown
- No console errors

#### 5.6.6: Run ESLint
**Command**:
```bash
npm run lint server.js public/app.js
```

**Completion Criteria**:
- ESLint passes

### Task 5.6 Quality Gates
- [ ] File upload button works
- [ ] Client-side validation implemented
- [ ] Server-side validation enhanced
- [ ] Error messages user-friendly
- [ ] All error scenarios tested
- [ ] ESLint passes

### Task 5.6 Completion
```bash
git add server.js public/app.js
git commit -m "Task 5.6: Add error handling and validation"
git checkout phase-5-file-upload
git merge phase-5/task-5.6-error-handling --squash
git commit -m "Task 5.6: Add error handling and validation

- Added file upload button handler
- Implemented client-side validation
- Enhanced server-side validation
- Improved error messages
- Tested error scenarios
- Quality gates passed"
```

---

## Phase 5 Completion

### Phase 5 Integration Test
```bash
# On phase-5-file-upload branch

# 1. Start server
npm start

# 2. Open browser and create session

# 3. Test file upload methods:

# A. Button upload
# - Click upload button
# - Select file
# - Verify upload succeeds

# B. Drag-and-drop
# - Drag file from desktop
# - Drop on terminal
# - Verify upload succeeds

# C. Paste (if supported)
# - Copy file/image
# - Paste in browser
# - Verify upload succeeds

# 4. Test error handling:
# - Upload without session selected
# - Upload file >100MB
# - Upload to stopped session

# 5. Test progress indicator
# - Upload multiple files
# - Verify progress updates

# 6. Verify files in session directory
# - Check working directory
# - Confirm files exist

# 7. Run linting
npm run lint

# 8. Check git status
git status  # Should be clean
```

### Expected Results
- All upload methods work
- Progress indicator functional
- Files copied to correct directories
- Error handling working
- ESLint passes
- Git working directory clean

### Phase 5 Quality Gates Checklist
- [ ] All tasks (5.1 - 5.6) completed
- [ ] Multer endpoint functional
- [ ] Drag-and-drop works
- [ ] Paste upload works
- [ ] Progress indicator displays
- [ ] Error handling robust
- [ ] File size limits enforced
- [ ] ESLint passes
- [ ] Integration test passed
- [ ] No uncommitted changes

### Merge to Main
```bash
git checkout main
git merge phase-5-file-upload -m "Phase 5: File Upload System Complete

Completed tasks:
- 5.1: Setup multer file upload endpoint
- 5.2: Implement file copy helper (Phase 6 ready)
- 5.3: Add drag-and-drop UI
- 5.4: Implement paste upload handler
- 5.5: Create upload progress UI
- 5.6: Add error handling and validation

Phase completion criteria met:
✓ POST /api/upload/:sessionId endpoint works
✓ Files upload via button, drag-drop, paste
✓ Files copied to session directory
✓ Upload progress indicator functional
✓ 100MB file size limit enforced
✓ Error handling robust
✓ iOS paste support included
✓ All quality gates passed

Ready for Phase 6: Multi-User Support & Security"

git push origin main
```

### Update PROGRESS.md
```bash
git checkout main
# Mark Phase 5 complete, prepare Phase 6
# Commit and push
```

---

## Next Steps

After Phase 5 completion:
1. Create Phase 6 branch: `git checkout -b phase-6-multi-user`
2. Read [phase-6.md](phase-6.md) for multi-user implementation
3. Execute Task 6.1 to begin user enumeration
