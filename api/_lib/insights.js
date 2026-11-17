// Return only the fields required by the agent-visible daily leaderboard.
// Coaching and identity details remain available only through the scoped insights view.
export function publicLeaderboardRows(rows) {
  return (rows || []).map(row => ({
    display_name: row.display_name,
    connect_rate: row.connect_rate,
    qualified: row.qualified,
    consultations: row.consultations,
    productive_actions: row.productive_actions
  }));
}
