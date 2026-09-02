import { all, one } from "../db/index.js";
import { leaderboard, levelFromXp } from "./staff.js";

export interface GuildStats {
  staff: { total: number; working: number; idle: number };
  tasks: Record<string, number>;
  throughput: { completedToday: number; completed7d: number; failed7d: number };
  meanRunSeconds: number;
  departments: Array<{ code: string; nameEn: string; accent: string; headcount: number; open: number; done: number }>;
  leaderboard: Array<{ id: string; displayName: string; xp: number; level: number; completedTasks: number }>;
}

const DAY = 86_400_000;

export function guildStats(): GuildStats {
  const staffCounts = one<{ total: number; working: number; idle: number }>(
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN status = 'working' THEN 1 ELSE 0 END) AS working,
            SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END) AS idle
     FROM staff`,
  ) ?? { total: 0, working: 0, idle: 0 };

  const stageRows = all<{ stage: string; n: number }>(
    "SELECT stage, COUNT(*) AS n FROM tasks WHERE hidden = 0 GROUP BY stage",
  );
  const tasks: Record<string, number> = {};
  for (const row of stageRows) tasks[row.stage] = row.n;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const week = Date.now() - 7 * DAY;

  const throughput = one<{ completedToday: number; completed7d: number; failed7d: number }>(
    `SELECT
       SUM(CASE WHEN stage = 'done' AND finished_at >= ? THEN 1 ELSE 0 END) AS completedToday,
       SUM(CASE WHEN stage = 'done' AND finished_at >= ? THEN 1 ELSE 0 END) AS completed7d,
       SUM(CASE WHEN stage = 'blocked' AND updated_at >= ? THEN 1 ELSE 0 END) AS failed7d
     FROM tasks`,
    startOfDay.getTime(),
    week,
    week,
  ) ?? { completedToday: 0, completed7d: 0, failed7d: 0 };

  const meanRun = one<{ avg: number }>(
    `SELECT AVG((finished_at - started_at) / 1000.0) AS avg
     FROM task_runs WHERE state = 'succeeded' AND started_at IS NOT NULL AND finished_at IS NOT NULL`,
  );

  const departments = all<{
    code: string;
    nameEn: string;
    accent: string;
    headcount: number;
    open: number;
    done: number;
  }>(
    `SELECT d.code, d.name_en AS nameEn, d.accent,
            (SELECT COUNT(*) FROM staff s WHERE s.department_id = d.id) AS headcount,
            (SELECT COUNT(*) FROM tasks t WHERE t.department_id = d.id AND t.stage NOT IN ('done','cancelled')) AS open,
            (SELECT COUNT(*) FROM tasks t WHERE t.department_id = d.id AND t.stage = 'done') AS done
     FROM departments d
     WHERE EXISTS (SELECT 1 FROM staff s WHERE s.department_id = d.id)
     ORDER BY d.sort_order`,
  );

  return {
    staff: {
      total: Number(staffCounts.total ?? 0),
      working: Number(staffCounts.working ?? 0),
      idle: Number(staffCounts.idle ?? 0),
    },
    tasks,
    throughput: {
      completedToday: Number(throughput.completedToday ?? 0),
      completed7d: Number(throughput.completed7d ?? 0),
      failed7d: Number(throughput.failed7d ?? 0),
    },
    meanRunSeconds: Math.round(Number(meanRun?.avg ?? 0)),
    departments,
    leaderboard: leaderboard(8).map((staff) => ({
      id: staff.id,
      displayName: staff.displayName,
      xp: staff.xp,
      level: levelFromXp(staff.xp).level,
      completedTasks: staff.completedTasks,
    })),
  };
}
