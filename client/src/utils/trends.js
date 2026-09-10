/**
 * Pure helper utilities for calculating category breakdowns and chronological trendlines
 */

// ponytail: in-memory linear aggregation; upgrade to server-side mongo $facet if client dataset exceeds 10k attempts
export function aggregateCategoryStats(attempts = []) {
  const statsMap = {};
  attempts.forEach(a => {
    const cat = a.questionSetId?.category?.trim() || 'General';
    const score = Number(a.score || 0);
    const maxScore = Number(a.maxPossibleScore || 0);
    const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : (score > 0 ? Math.min(100, score) : 0);

    if (!statsMap[cat]) {
      statsMap[cat] = {
        name: cat,
        totalAttempts: 0,
        completedCount: 0,
        sumPct: 0,
        bestPct: 0,
        totalPoints: 0,
      };
    }
    statsMap[cat].totalAttempts += 1;
    if (a.status === 'completed') statsMap[cat].completedCount += 1;
    statsMap[cat].sumPct += pct;
    statsMap[cat].totalPoints += score;
    if (pct > statsMap[cat].bestPct) statsMap[cat].bestPct = pct;
  });

  return Object.values(statsMap)
    .map(item => ({
      ...item,
      avgPct: item.totalAttempts > 0 ? Math.round(item.sumPct / item.totalAttempts) : 0,
    }))
    .sort((a, b) => b.totalAttempts - a.totalAttempts);
}

export function computeRecentTrends(attempts = [], { category = 'All', limit = 15 } = {}) {
  const filtered = attempts.filter(a => {
    if (!category || category === 'All') return true;
    return (a.questionSetId?.category?.trim() || 'General').toLowerCase() === category.toLowerCase();
  });

  return [...filtered]
    .sort((a, b) => new Date(a.startedAt || a.createdAt || 0) - new Date(b.startedAt || b.createdAt || 0))
    .slice(-limit);
}
