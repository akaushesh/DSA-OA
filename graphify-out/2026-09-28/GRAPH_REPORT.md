# Graph Report - DSA-OA  (2026-09-28)

## Corpus Check
- 90 files · ~49,800 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 394 nodes · 704 edges · 28 communities (24 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6bcab967`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Admin Controller Layer|Admin Controller Layer]]
- [[_COMMUNITY_Admin UI Pages|Admin UI Pages]]
- [[_COMMUNITY_Attempt Monitor & API|Attempt Monitor & API]]
- [[_COMMUNITY_Attempt Controller Logic|Attempt Controller Logic]]
- [[_COMMUNITY_Client Dependencies & Config|Client Dependencies & Config]]
- [[_COMMUNITY_Auth State & User Attempts|Auth State & User Attempts]]
- [[_COMMUNITY_Server Dependencies & Config|Server Dependencies & Config]]
- [[_COMMUNITY_Submission Controller|Submission Controller]]
- [[_COMMUNITY_Category Trends Chart|Category Trends Chart]]
- [[_COMMUNITY_Auth Service & Token Mgmt|Auth Service & Token Mgmt]]
- [[_COMMUNITY_Topic Aggregator Utility|Topic Aggregator Utility]]
- [[_COMMUNITY_Scoring Test Utilities|Scoring Test Utilities]]
- [[_COMMUNITY_Starter Code Tests|Starter Code Tests]]
- [[_COMMUNITY_Client Scoring Utilities|Client Scoring Utilities]]
- [[_COMMUNITY_Server Scoring Utilities|Server Scoring Utilities]]
- [[_COMMUNITY_DB & Server Entry Points|DB & Server Entry Points]]
- [[_COMMUNITY_Dev Start Scripts|Dev Start Scripts]]
- [[_COMMUNITY_Client Vercel Config|Client Vercel Config]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]

## God Nodes (most connected - your core abstractions)
1. `AuthService` - 15 edges
2. `Navbar()` - 12 edges
3. `ApiError` - 11 edges
4. `asyncHandler()` - 10 edges
5. `ApiResponse` - 9 edges
6. `API` - 7 edges
7. `verifyJWT` - 7 edges
8. `scripts` - 6 edges
9. `verifyAdmin` - 6 edges
10. `runOne()` - 6 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (28 total, 4 thin omitted)

### Community 0 - "Admin Controller Layer"
Cohesion: 0.06
Nodes (57): getAttemptTrends, getStats, getUserDetails, listUsers, updateUserRole, createProblem, deleteProblem, getProblemAdmin (+49 more)

### Community 1 - "Admin UI Pages"
Cohesion: 0.23
Nodes (7): emptyForm, API, createProblem(), deleteProblem(), getProblem(), getProblems(), updateProblem()

### Community 2 - "Attempt Monitor & API"
Cohesion: 0.18
Nodes (11): SAMPLE_DSA_JSON, TIMER_PRESETS, startAttempt(), createQuestionSet(), deleteQuestionSet(), getQuestionSet(), importQuestionSet(), reevaluateQuestionSet() (+3 more)

### Community 3 - "Attempt Controller Logic"
Cohesion: 0.12
Nodes (22): adjustAttemptTime, allAttempts, deleteAttempt, endAttempt, getAttemptReview, getMyAttemptedTopics, myAttempts, pinSubmission (+14 more)

### Community 4 - "Client Dependencies & Config"
Cohesion: 0.06
Nodes (31): dependencies, axios, @monaco-editor/react, react, react-dom, react-hot-toast, react-redux, react-router-dom (+23 more)

### Community 5 - "Auth State & User Attempts"
Cohesion: 0.11
Nodes (13): myAttempts(), authSlice, initialState, initialState, roleSlice, storage, store, Protected() (+5 more)

### Community 6 - "Server Dependencies & Config"
Cohesion: 0.08
Nodes (24): author, dependencies, axios, bcryptjs, cookie-parser, cors, dotenv, express (+16 more)

### Community 7 - "Submission Controller"
Cohesion: 0.39
Nodes (7): ensureIncludeHeaders(), execPromise, executeProcess(), INCLUDE_DIR, runAllTestCases(), runCustomInput(), runOne()

### Community 8 - "Category Trends Chart"
Cohesion: 0.09
Nodes (22): getAttemptTrends(), getStats(), getUserDetails(), listUsers(), updateUserRole(), CATEGORY_COLORS, CategoryTrendsChart(), DEFAULT_COLOR (+14 more)

### Community 10 - "Topic Aggregator Utility"
Cohesion: 0.24
Nodes (7): TestCaseBox(), longString, multiLine, res1, res2, res3, truncateTestCaseText()

### Community 11 - "Scoring Test Utilities"
Cohesion: 0.33
Nodes (5): problems, resultEmpty, resultLast, resultMax, submissions

### Community 12 - "Starter Code Tests"
Cohesion: 0.33
Nodes (5): res1, res2, res3, res4, res5

### Community 13 - "Client Scoring Utilities"
Cohesion: 0.50
Nodes (3): calculateProblemScore(), getDifficultyPoints(), SCORING_RULES

### Community 14 - "Server Scoring Utilities"
Cohesion: 0.50
Nodes (3): calculateProblemScore(), getDifficultyPoints(), SCORING_RULES

### Community 23 - "Community 23"
Cohesion: 0.16
Nodes (13): DiffViewer(), computeOutputDiff(), delLine, diffTokenA, diffTokenB, res1, res2, res3 (+5 more)

### Community 24 - "Community 24"
Cohesion: 0.18
Nodes (8): saveTimers(), getSubmission(), mySubmissions(), runCustomCode(), submitCode(), ModalConfirm(), STARTERS, getProblemStarter()

### Community 25 - "Community 25"
Cohesion: 0.22
Nodes (7): getAttempt(), reevaluateAttempt(), getQuestionSets(), Loader(), COLORS, VerdictBadge(), CATEGORIES

### Community 26 - "Community 26"
Cohesion: 0.36
Nodes (7): adjustAttemptTime(), allAttempts(), deleteAttempt(), endAttempt(), pinSubmission(), resetAttempt(), stopAttempt()

### Community 27 - "Community 27"
Cohesion: 0.40
Nodes (3): getMyAttemptedTopics(), COLORS, DifficultyChip()

## Knowledge Gaps
- **127 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+122 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthService` connect `Auth Service & Token Mgmt` to `Auth State & User Attempts`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `Attempt Monitor & API` to `Admin UI Pages`, `Category Trends Chart`, `Community 25`, `Community 26`, `Community 27`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _127 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Controller Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.05546218487394958 - nodes in this community are weakly interconnected._
- **Should `Attempt Controller Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.12307692307692308 - nodes in this community are weakly interconnected._
- **Should `Client Dependencies & Config` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._
- **Should `Auth State & User Attempts` be split into smaller, more focused modules?**
  _Cohesion score 0.1103448275862069 - nodes in this community are weakly interconnected._