/**
 * Pure helper function to aggregate questions and attempts by DSA topic (category)
 * ponytail: O(A * P + S) in-memory aggregation of a user's attempts; upgrade to MongoDB $facet if single-user attempt history exceeds 10k items
 */

const VERDICT_PRIORITY = {
  AC: 1,
  WA: 2,
  TLE: 3,
  MLE: 4,
  RE: 5,
  CE: 6,
  Pending: 7,
  Unattempted: 8,
};

export function aggregateTopicsFromAttempts(attempts = []) {
  const problemsMap = new Map();

  attempts.forEach((att) => {
    const set = att.questionSetId;
    if (!set) return;

    const problems = set.problems || [];
    const submissions = att.submissions || [];

    // Group submissions in this attempt by problemId
    const subsByProblem = {};
    submissions.forEach((sub) => {
      const pId = (sub.problemId?._id || sub.problemId)?.toString();
      if (!pId) return;
      if (!subsByProblem[pId]) subsByProblem[pId] = [];
      subsByProblem[pId].push(sub);
    });

    problems.forEach((prob) => {
      if (!prob) return;
      const pId = (prob._id || prob).toString();
      const pSubs = subsByProblem[pId] || [];

      // Determine best verdict & score for this problem in this specific attempt
      let attemptVerdict = 'Unattempted';
      let attemptScore = 0;
      let latestSubmissionTime = null;

      if (pSubs.length > 0) {
        const acSub = pSubs.find((s) => s.verdict === 'AC');
        if (acSub) {
          attemptVerdict = 'AC';
          attemptScore = acSub.score || 0;
        } else {
          // Find submission with highest priority verdict or highest score
          const sortedByVerdict = [...pSubs].sort(
            (a, b) => (VERDICT_PRIORITY[a.verdict] || 99) - (VERDICT_PRIORITY[b.verdict] || 99)
          );
          attemptVerdict = sortedByVerdict[0]?.verdict || 'WA';
          attemptScore = Math.max(...pSubs.map((s) => s.score || 0));
        }

        // Get latest submission timestamp
        const sortedByDate = [...pSubs].sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
        latestSubmissionTime = sortedByDate[0]?.submittedAt || null;
      }

      const category = prob.category?.trim() || set.category?.trim() || 'General';

      if (!problemsMap.has(pId)) {
        problemsMap.set(pId, {
          _id: pId,
          title: prob.title || 'Untitled Problem',
          difficulty: prob.difficulty || 'Medium',
          category,
          tags: Array.isArray(prob.tags) ? prob.tags : [],
          bestVerdict: attemptVerdict,
          bestScore: attemptScore,
          isSolved: attemptVerdict === 'AC',
          hasSubmissions: pSubs.length > 0,
          totalSubmissionsCount: pSubs.length,
          attempts: [],
        });
      } else {
        const existing = problemsMap.get(pId);
        existing.totalSubmissionsCount += pSubs.length;
        if (pSubs.length > 0) existing.hasSubmissions = true;
        if (attemptVerdict === 'AC') {
          existing.isSolved = true;
          existing.bestVerdict = 'AC';
          existing.bestScore = Math.max(existing.bestScore, attemptScore);
        } else if (!existing.isSolved) {
          if (
            (VERDICT_PRIORITY[attemptVerdict] || 99) < (VERDICT_PRIORITY[existing.bestVerdict] || 99)
          ) {
            existing.bestVerdict = attemptVerdict;
          }
          existing.bestScore = Math.max(existing.bestScore, attemptScore);
        }
      }

      // Add attempt record to this problem
      problemsMap.get(pId).attempts.push({
        attemptId: att._id,
        questionSetName: set.name || 'Assessment',
        startedAt: att.startedAt,
        status: att.status,
        attemptScore: att.score || 0,
        verdict: attemptVerdict,
        score: attemptScore,
        submissionsCount: pSubs.length,
        submittedAt: latestSubmissionTime,
      });
    });
  });

  // Group problems by category / topic
  const topicsMap = {};

  for (const problem of problemsMap.values()) {
    const topic = problem.category || 'General';
    if (!topicsMap[topic]) {
      topicsMap[topic] = {
        name: topic,
        totalQuestions: 0,
        solvedCount: 0,
        attemptedCount: 0, // questions with at least 1 submission
        problems: [],
      };
    }

    topicsMap[topic].totalQuestions += 1;
    if (problem.isSolved) topicsMap[topic].solvedCount += 1;
    if (problem.hasSubmissions) topicsMap[topic].attemptedCount += 1;

    // Sort attempts by startedAt desc
    problem.attempts.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
    topicsMap[topic].problems.push(problem);
  }

  // Calculate summary metrics
  const topics = Object.values(topicsMap)
    .map((t) => ({
      ...t,
      accuracyRate: t.totalQuestions > 0 ? Math.round((t.solvedCount / t.totalQuestions) * 100) : 0,
      problems: t.problems.sort((a, b) => {
        // Solved first or most recent
        if (a.isSolved !== b.isSolved) return a.isSolved ? -1 : 1;
        return a.title.localeCompare(b.title);
      }),
    }))
    .sort((a, b) => b.totalQuestions - a.totalQuestions);

  let totalQuestions = 0;
  let totalSolved = 0;
  let totalAttempted = 0;

  topics.forEach((t) => {
    totalQuestions += t.totalQuestions;
    totalSolved += t.solvedCount;
    totalAttempted += t.attemptedCount;
  });

  return {
    topics,
    stats: {
      totalTopics: topics.length,
      totalQuestions,
      totalSolved,
      totalAttempted,
      overallAccuracy: totalQuestions > 0 ? Math.round((totalSolved / totalQuestions) * 100) : 0,
    },
  };
}
