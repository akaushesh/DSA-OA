# Graph Report - .  (2026-09-25)

## Corpus Check
- Corpus is ~47,208 words - fits in a single context window. You may not need a graph.

## Summary
- 376 nodes · 676 edges · 23 communities (19 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

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

## Communities (23 total, 4 thin omitted)

### Community 0 - "Admin Controller Layer"
Cohesion: 0.08
Nodes (35): getAttemptTrends, getStats, getUserDetails, listUsers, updateUserRole, createProblem, deleteProblem, getProblemAdmin (+27 more)

### Community 1 - "Admin UI Pages"
Cohesion: 0.08
Nodes (27): emptyForm, SAMPLE_DSA_JSON, TIMER_PRESETS, getAttemptTrends(), getStats(), getUserDetails(), listUsers(), updateUserRole() (+19 more)

### Community 2 - "Attempt Monitor & API"
Cohesion: 0.08
Nodes (28): adjustAttemptTime(), allAttempts(), deleteAttempt(), endAttempt(), getAttempt(), getMyAttemptedTopics(), reevaluateAttempt(), resetAttempt() (+20 more)

### Community 3 - "Attempt Controller Logic"
Cohesion: 0.11
Nodes (26): adjustAttemptTime, allAttempts, deleteAttempt, endAttempt, getAttemptReview, getMyAttemptedTopics, myAttempts, reevaluateAttempt (+18 more)

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
Cohesion: 0.17
Nodes (15): getSubmission, mySubmissions, runCustom, submitCode, exampleSchema, Problem, problemSchema, testCaseSchema (+7 more)

### Community 8 - "Category Trends Chart"
Cohesion: 0.13
Nodes (16): CATEGORY_COLORS, CategoryTrendsChart(), DEFAULT_COLOR, getCategoryColor(), aggregateCategoryStats(), computeRecentTrends(), allTrends, arrayStat (+8 more)

### Community 10 - "Topic Aggregator Utility"
Cohesion: 0.20
Nodes (9): aggregateTopicsFromAttempts(), arraysTopic, emptyResult, invertTree, mockAttempts, result, threeSum, treesTopic (+1 more)

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

## Knowledge Gaps
- **118 isolated node(s):** `name`, `private`, `version`, `type`, `dev` (+113 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AuthService` connect `Auth Service & Token Mgmt` to `Auth State & User Attempts`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Why does `Navbar()` connect `Admin UI Pages` to `Attempt Monitor & API`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _118 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Admin Controller Layer` be split into smaller, more focused modules?**
  _Cohesion score 0.08106219426974144 - nodes in this community are weakly interconnected._
- **Should `Admin UI Pages` be split into smaller, more focused modules?**
  _Cohesion score 0.07673469387755102 - nodes in this community are weakly interconnected._
- **Should `Attempt Monitor & API` be split into smaller, more focused modules?**
  _Cohesion score 0.07678075855689177 - nodes in this community are weakly interconnected._
- **Should `Attempt Controller Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.10695187165775401 - nodes in this community are weakly interconnected._