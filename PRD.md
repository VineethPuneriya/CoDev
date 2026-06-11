# Product Requirements Document (PRD)

**Project Name:** `CoDev` (Unified Developer Workspace)
**Target Architecture:** PERN Stack (PostgreSQL, Express, React, Node.js) + Prisma + Yjs

## 1. Product Vision
To provide development teams with a unified, browser-based ecosystem that eliminates context-switching. The platform merges real-time text collaboration, project management, live code execution, and a multi-modal communication suite into a single workspace.

## 2. Scope Boundaries
*   **V1 (The MVP - Completed):** User Authentication, Role-Based Access Control (RBAC), UI-first Dashboard, Live Monaco Editor (CRDT Syncing via WebSockets), Recursive File Tree, Code Execution Engine, Team Chat, and Issue Tracking.
*   **V2 (Active Development):** Secure Invitation Handshakes, WebRTC audio/video/screen-sharing, Real Git Integration, Algorithmic Testing Sandboxes, Architecture Whiteboards, and AI Copilot integration.

## 3. User Roles & Permissions Matrix
Access to workspace actions is strictly governed by the backend utilizing PostgreSQL relationships.

| Role | Capabilities | Primary UI View |
| :--- | :--- | :--- |
| **Admin (Host)** | Invite members, change roles, edit/run code, raise/close issues, approve merges. | Full Workspace |
| **Maintainer** | Edit/run code, raise/close issues, request merges. | Standard Workspace |
| **Contributor** | Edit code, raise issues. | Standard Workspace (Exec/Merge hidden) |

## 4. Core Feature Requirements

### Epic 1: Authentication & Dashboard
*   **Req 1.1:** Users must be able to sign up and log in using an email and password (JWT standard).
*   **Req 1.2:** Users must see a Dashboard displaying all projects they are a member of.
*   **Req 1.3:** Users can create a new project, automatically assigning themselves the "Admin" role.

### Epic 2: The Visual Workspace & Execution
*   **Req 2.1:** The workspace must display a dark-mode Monaco Editor as the central component with dynamic language syntax highlighting.
*   **Req 2.2:** The workspace must support a recursive, dynamic file tree UI mapped to database records.
*   **Req 2.3:** The workspace must include a secure execution engine bridging the frontend UI to backend `child_process` execution for Python and Node.js.

### Epic 3: Real-Time Collaboration & Tracking
*   **Req 3.1:** The Monaco Editor must be connected to an Express/Node.js backend via WebSockets (`socket.io`), managed by `yjs` (CRDTs).
*   **Req 3.2:** The workspace must feature a live Socket.io team chat and a Prisma-backed Issue Tracker.

### Epic 4: V2 Expansion (Communication & Tooling)
*   **Req 4.1:** Users must explicitly accept or reject project invitations via a secure handshake protocol.
*   **Req 4.2:** The workspace must support WebRTC peer-to-peer audio, video, and screen sharing.
*   **Req 4.3:** The platform must include an Algorithmic Arena for executing multiple test cases against logic-heavy code.

---

## 5. Technical Architecture
*   **Frontend:** React (Vite). Styled with a modern component library and custom CSS.
*   **Backend:** Node.js with Express.
*   **Real-Time Data:** `y-websocket` and `socket.io` running natively on the Express server.
*   **Database:** PostgreSQL for rigid ACID-compliant schema enforcement.
*   **ORM:** Prisma to handle schema generation, strict relations, and type-safe database queries.
*   **Media Streaming (V2):** WebRTC APIs with backend Signaling via Socket.io.

---

## 6. V1 Execution Roadmap (Completed)
*   **Phase 1: The UI Skeleton & Static Routing**
*   **Phase 2: Database Architecture & Gateway API**
*   **Phase 3: The Web IDE Integration**
*   **Phase 4: The Collaboration Engine (Yjs/Socket.io)**
*   **Phase 5: The File System Engine & Visual UX**
*   **Phase 6: The Execution Engine** (Node/Python `child_process` bridge and Terminal UI).
*   **Phase 7: The Team & Invitation System** (Database RBAC and UI Modals).
*   **Phase 8: Issue Tracker & Team Chat** (Socket.io broadcasts and Prisma Issue models).

---

## 7. V2 Expansion Roadmap (Active Development)

*   **Phase 9: The Consent & Handshake Protocol**
    Overhaul the Prisma schema to introduce an `Invitation` model (`PENDING`, `ACCEPTED`, `REJECTED`). Build an inbox UI on the Dashboard so users can actively manage access requests.
*   **Phase 10: The WebRTC Media Engine (The Virtual War Room)**
    Upgrade the Express server to act as a WebRTC signaling server. Integrate the browser `MediaDevices` API to enable floating video calls and screen sharing directly over the IDE.
*   **Phase 11: Global UI/UX Polish**
    Implement global light/dark mode context, override native browser scrollbars with custom CSS, and purge all remaining mock data and dummy accounts from the database and UI.
*   **Phase 12: Version Control Integration (The Git Engine)**
    Build a backend proxy to connect workspaces directly to external GitHub/GitLab repositories for staging, committing, and pushing code.
*   **Phase 13: The Algorithmic Arena**
    Expand the execution engine to handle structured test cases (standard input/output parsing). Design a dedicated UI panel optimized for validating complex logic like dynamic programming and graph traversals with visual Pass/Fail metrics.
*   **Phase 14: Integrated Whiteboard (Architecture Canvas)**
    Embed a shared, infinite canvas (e.g., Excalidraw) synced via WebSockets for real-time system design.
*   **Phase 15: Context-Aware AI Copilot**
    Integrate an LLM API into a chat panel that can read the active file and suggest direct code modifications.