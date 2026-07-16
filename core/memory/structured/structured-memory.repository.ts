import { eq } from "drizzle-orm";
import type { UserContext } from "../../identity/user-context";
import type { Database } from "../../db/client";
import {
  type Goal,
  type Habit,
  type Person,
  type Project,
  goals,
  habits,
  people,
  projects,
  users,
} from "../../db/schema";

/**
 * Memoria estructurada: hechos permanentes del usuario, materializados
 * como las tablas tipadas (users, projects, goals, habits, people) — no
 * como un modelo Entity-Attribute-Value.
 */
export interface StructuredMemorySnapshot {
  name: string | null;
  projects: Project[];
  goals: Goal[];
  habits: Habit[];
  people: Person[];
}

export interface StructuredMemoryRepository {
  getSnapshot(context: UserContext): Promise<StructuredMemorySnapshot>;
}

export class DrizzleStructuredMemoryRepository
  implements StructuredMemoryRepository
{
  constructor(private readonly db: Database) {}

  async getSnapshot(context: UserContext): Promise<StructuredMemorySnapshot> {
    const { userId } = context;

    const [user, userProjects, userGoals, userHabits, userPeople] =
      await Promise.all([
        this.db
          .select({ name: users.name })
          .from(users)
          .where(eq(users.id, userId))
          .limit(1),
        this.db.select().from(projects).where(eq(projects.userId, userId)),
        this.db.select().from(goals).where(eq(goals.userId, userId)),
        this.db.select().from(habits).where(eq(habits.userId, userId)),
        this.db.select().from(people).where(eq(people.userId, userId)),
      ]);

    return {
      name: user[0]?.name ?? null,
      projects: userProjects,
      goals: userGoals,
      habits: userHabits,
      people: userPeople,
    };
  }
}
