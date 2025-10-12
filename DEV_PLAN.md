# Claude Code Web Monitor - Development Plan

## Overview
This document outlines the complete development plan for building the Claude Code Web Monitor application. The plan is divided into 7 phases, each with specific tasks, subtasks, completion criteria, and quality gates.

## Repository Structure
```
Micro-Wormhole/
├── DEV_PLAN.md                    # This file - overview and navigation
├── dev-plan/                      # Detailed phase plans
│   ├── phase-1.md                 # Project Setup
│   ├── phase-2.md                 # Backend Core Infrastructure
│   ├── phase-3.md                 # Database & Session Management
│   ├── phase-4.md                 # Frontend UI
│   ├── phase-5.md                 # File Upload System
│   ├── phase-6.md                 # Multi-User Support & Security
│   └── phase-7.md                 # Testing & Deployment
└── claude-code-monitor/           # Application code (created in Phase 1)
```

## Git Branching Strategy

### Branch Naming Convention
- **Main branch**: `main` - Production-ready code only
- **Phase branches**: `phase-N-description` (e.g., `phase-1-project-setup`)
- **Task branches**: `phase-N/task-N.M-description` (e.g., `phase-1/task-1.2-eslint-setup`)

### Workflow
1. Create phase branch from `main` at phase start
2. Create task branch from phase branch for each task
3. Complete task with all subtasks and quality gates
4. Merge task branch back to phase branch (fast-forward or squash)
5. At phase completion, merge phase branch to `main` (merge commit with phase summary)

### Quality Gates (Before Task Completion)
Every task must pass ALL quality gates before being marked complete:

1. **Linting**: Code passes ESLint with zero errors
2. **Type Checking**: No TypeScript/JSDoc errors (if applicable)
3. **Code Review**: Self-review completed, no obvious issues
4. **Functional Test**: Manual verification that the feature works as specified
5. **Documentation**: All required comments/docs written
6. **Git Status**: No uncommitted changes, branch clean

### Merge Requirements (Phase Completion)
Before merging phase branch to `main`:

1. All tasks in phase completed with quality gates passed
2. Phase integration test passed (all phase features work together)
3. No regressions in previous phase features
4. Code coverage maintained or improved
5. Documentation updated
6. CHANGELOG.md updated with phase summary

## Phase Overview

### [Phase 1: Project Setup](dev-plan/phase-1.md)
**Branch**: `phase-1-project-setup`
**Duration**: ~2 hours
**Completion Criteria**:
- Node.js project initialized with all dependencies
- Linting and code quality tools configured
- Git workflow established
- Basic project structure created

**Tasks**:
- 1.1 Initialize Node.js project
- 1.2 Setup ESLint and code formatting
- 1.3 Create directory structure
- 1.4 Configure environment variables
- 1.5 Setup logging infrastructure

---

### [Phase 2: Backend Core Infrastructure](dev-plan/phase-2.md)
**Branch**: `phase-2-backend-core`
**Duration**: ~4 hours
**Completion Criteria**:
- Express server running on port 3456
- Socket.io connected and functional
- Basic health check endpoint working
- Static file serving operational
- Winston logging active

**Tasks**:
- 2.1 Create Express server foundation
- 2.2 Setup Socket.io with Express
- 2.3 Configure static file serving
- 2.4 Implement graceful shutdown
- 2.5 Add health check and monitoring

---

### [Phase 3: Database & Session Management](dev-plan/phase-3.md)
**Branch**: `phase-3-session-management`
**Duration**: ~6 hours
**Completion Criteria**:
- SQLite database initialized with schema
- Session CRUD operations working
- PTY processes spawn and communicate
- Terminal output buffering functional
- Session lifecycle managed correctly

**Tasks**:
- 3.1 Initialize SQLite database
- 3.2 Implement session data layer
- 3.3 Create PTY process manager
- 3.4 Implement session lifecycle handlers
- 3.5 Add Socket.io session events

---

### [Phase 4: Frontend UI](dev-plan/phase-4.md)
**Branch**: `phase-4-frontend-ui`
**Duration**: ~8 hours
**Completion Criteria**:
- Responsive UI working on desktop and mobile
- Session list displays and updates
- Terminal renders with xterm.js
- New session modal functional
- All UI interactions work correctly

**Tasks**:
- 4.1 Create HTML structure
- 4.2 Implement CSS styling
- 4.3 Build session list UI
- 4.4 Integrate xterm.js terminal
- 4.5 Create new session modal
- 4.6 Implement Socket.io client handlers
- 4.7 Add responsive design and mobile support

---

### [Phase 5: File Upload System](dev-plan/phase-5.md)
**Branch**: `phase-5-file-upload`
**Duration**: ~5 hours
**Completion Criteria**:
- File upload endpoint working
- Drag-and-drop functional
- Paste upload working (including iOS)
- Progress indicator displays correctly
- Files copied to session directory with correct ownership

**Tasks**:
- 5.1 Setup multer file upload endpoint
- 5.2 Implement file copy with sudo
- 5.3 Add drag-and-drop UI
- 5.4 Implement paste upload handler
- 5.5 Create upload progress UI
- 5.6 Add error handling and validation

---

### [Phase 6: Multi-User Support & Security](dev-plan/phase-6.md)
**Branch**: `phase-6-multi-user`
**Duration**: ~6 hours
**Completion Criteria**:
- System users enumerated correctly
- Sessions spawn as specified user
- Sudo configuration documented
- User validation working
- Security best practices implemented

**Tasks**:
- 6.1 Implement user enumeration
- 6.2 Add user selection to UI
- 6.3 Implement sudo-based process spawning
- 6.4 Create sudo configuration guide
- 6.5 Add user validation and security checks
- 6.6 Test multi-user functionality

---

### [Phase 7: Testing & Deployment](dev-plan/phase-7.md)
**Branch**: `phase-7-deployment`
**Duration**: ~6 hours
**Completion Criteria**:
- All features tested end-to-end
- Systemd service configured
- Installation script created
- Documentation complete
- README.md with setup instructions
- Application deployable on Linux server

**Tasks**:
- 7.1 End-to-end testing
- 7.2 Create systemd service
- 7.3 Write installation script
- 7.4 Create comprehensive README
- 7.5 Add troubleshooting guide
- 7.6 Final integration testing
- 7.7 Production deployment verification

---

### [Phase 8: File Editor Panel](dev-plan/phase-8.md)
**Branch**: `phase-8-file-editor`
**Duration**: ~6 hours
**Completion Criteria**:
- Backend file reading endpoints functional
- Monaco Editor integrated with syntax highlighting
- File browser displays session files
- Collapsible panel works smoothly
- File changes auto-reload in editor
- Path traversal protection verified
- File size limits enforced
- Responsive design for mobile

**Tasks**:
- 8.1 Create file manager backend
- 8.2 Update UI layout for editor panel
- 8.3 Integrate Monaco Editor
- 8.4 Add file browser UI
- 8.5 Implement file change detection

**Note**: This phase implements issue #2 - adds collapsible file editor to review Claude Code edits.

---

## How to Use This Plan

### Starting a Phase
```bash
# Checkout main and pull latest
git checkout main
git pull origin main

# Create phase branch
git checkout -b phase-N-description
```

### Working on a Task
```bash
# Create task branch from phase branch
git checkout phase-N-description
git checkout -b phase-N/task-N.M-description

# Work on task...
# Run quality gates before committing
npm run lint
npm run test (if applicable)

# Commit with descriptive message
git add .
git commit -m "Complete task N.M: description"
```

### Completing a Task
Before marking task complete, verify ALL quality gates:

```bash
# 1. Run linting
npm run lint

# 2. Check git status
git status  # Should be clean

# 3. Verify functionality manually
# Test the specific feature you implemented

# 4. Merge to phase branch
git checkout phase-N-description
git merge phase-N/task-N.M-description --squash
git commit -m "Task N.M: description

- Subtask 1 completed
- Subtask 2 completed
- Quality gates passed"
```

### Completing a Phase
Before merging to main:

```bash
# On phase branch, verify phase completion criteria
# Run full phase integration test
# Update CHANGELOG.md

git checkout main
git merge phase-N-description -m "Phase N: Description

Completed tasks:
- Task N.1: Description
- Task N.2: Description
...

Phase completion criteria met:
- Criterion 1
- Criterion 2
...
"

git push origin main
```

## Prompting Claude

Use specific task references when prompting Claude Code:

```
Execute task 1.2.3
```

This refers to:
- **Phase 1**
- **Task 2**
- **Subtask 3**

Claude will read the corresponding phase file and execute the specific subtask with all requirements, completion criteria, and quality gates.

## Progress Tracking

Create a `PROGRESS.md` file to track completion:

```markdown
# Development Progress

## Phase 1: Project Setup ✅
- [x] 1.1 Initialize Node.js project
- [x] 1.2 Setup ESLint
- [x] 1.3 Create directory structure
- [x] 1.4 Configure environment
- [x] 1.5 Setup logging

## Phase 2: Backend Core Infrastructure 🚧
- [x] 2.1 Express server
- [ ] 2.2 Socket.io setup
...
```

## Notes

- **No Substitutions**: Use EXACT packages specified in issue #1
- **Quality First**: Never skip quality gates
- **Documentation**: Update docs as you code, not after
- **Testing**: Test each task immediately after completion
- **Commit Often**: Small, focused commits with clear messages
- **Ask Questions**: If spec is unclear, refer back to issue #1

## Time Estimates

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 1 | 2 hours | 2 hours |
| Phase 2 | 4 hours | 6 hours |
| Phase 3 | 6 hours | 12 hours |
| Phase 4 | 8 hours | 20 hours |
| Phase 5 | 5 hours | 25 hours |
| Phase 6 | 6 hours | 31 hours |
| Phase 7 | 6 hours | 37 hours |
| Phase 8 | 6 hours | 43 hours |

**Core application (Phases 1-7)**: 37 hours (~5 working days)
**With file editor (Phases 1-8)**: 43 hours (~5.5 working days)

## Support

If you encounter issues:
1. Check the specific phase file for detailed instructions
2. Review issue #1 for original specification
3. Check PROGRESS.md for current status
4. Verify all quality gates are configured correctly
