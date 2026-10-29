import { integer, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core";

export const attendanceLogs = pgTable("attendance_logs", {
  id: serial("id").primaryKey(),
  faceCount: integer("face_count").notNull(),
  source: varchar("source", { length: 20 }).notNull().default("camera"),
  detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
});
