export const SCORING_RULES = {
  Easy: {
    totalPoints: 100,
    tcPoints: [5, 10, 15, 20, 20, 20],
    bonus: 10,
  },
  Medium: {
    totalPoints: 250,
    tcPoints: [10, 20, 35, 45, 55, 60],
    bonus: 25,
  },
  Hard: {
    totalPoints: 450,
    tcPoints: [15, 35, 60, 80, 105, 110],
    bonus: 45,
  },
};

export function getDifficultyPoints(difficulty = 'Easy') {
  const diff = (difficulty || 'Easy').trim();
  const normalized = diff.charAt(0).toUpperCase() + diff.slice(1).toLowerCase();
  return SCORING_RULES[normalized] || SCORING_RULES.Easy;
}

/**
 * Calculates score for a submission based on difficulty, test cases passed, and all 6 solved bonus.
 * Easy (100): TC1(5) + TC2(10) + TC3(15) + TC4(20) + TC5(20) + TC6(20) + Bonus(10) = 100
 * Medium (250): TC1(10) + TC2(20) + TC3(35) + TC4(45) + TC5(55) + TC6(60) + Bonus(25) = 250
 * Hard (450): TC1(15) + TC2(35) + TC3(60) + TC4(80) + TC5(105) + TC6(110) + Bonus(45) = 450
 */
export function calculateProblemScore(difficulty, passedTests = 0, totalTests = 0) {
  const rules = getDifficultyPoints(difficulty);
  if (!totalTests || passedTests <= 0) return 0;
  if (passedTests >= totalTests && totalTests > 0) return rules.totalPoints;

  if (totalTests === 6) {
    let score = 0;
    for (let i = 0; i < passedTests && i < 6; i++) {
      score += rules.tcPoints[i];
    }
    if (passedTests === 6) {
      score += (rules.bonus || 0);
    }
    return score;
  }

  // If problem has fewer or more than 6 test cases, calculate proportionally
  return Math.round((passedTests / totalTests) * rules.totalPoints);
}

/**
 * Calculates an attempt's total score by taking the MAX score per question (not the last).
 * Returns { totalScore, maxPossibleScore, problemScores: { [problemId]: maxScore }, percentage }
 */
export function calculateAttemptScoreBreakdown(problems = [], submissions = []) {
  const problemScores = {};
  let totalScore = 0;
  let maxPossibleScore = 0;

  // Group submissions by problemId
  const subsByProblem = {};
  submissions.forEach((sub) => {
    const pId = (sub.problemId?._id || sub.problemId)?.toString();
    if (!pId) return;
    if (!subsByProblem[pId]) subsByProblem[pId] = [];
    subsByProblem[pId].push(sub);
  });

  problems.forEach((p) => {
    const pId = (p._id || p)?.toString();
    const rules = getDifficultyPoints(p.difficulty);
    maxPossibleScore += rules.totalPoints;

    const probSubs = subsByProblem[pId] || [];
    let maxScoreForProblem = 0;

    probSubs.forEach((sub) => {
      const subScore =
        sub.score !== undefined && sub.score !== null
          ? sub.score
          : calculateProblemScore(p.difficulty, sub.passedTests, sub.totalTests);
      if (subScore > maxScoreForProblem) {
        maxScoreForProblem = subScore;
      }
    });

    problemScores[pId] = maxScoreForProblem;
    totalScore += maxScoreForProblem;
  });

  const percentage = maxPossibleScore > 0 ? Math.round((totalScore / maxPossibleScore) * 100) : 0;

  return {
    totalScore,
    maxPossibleScore,
    problemScores,
    percentage,
  };
}
