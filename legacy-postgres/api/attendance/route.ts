import { desc } from "drizzle-orm";
import { db } from "@/db";
import { attendanceLogs } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const records = await db
      .select()
      .from(attendanceLogs)
      .orderBy(desc(attendanceLogs.detectedAt))
      .limit(100);

    return Response.json({
      records: records.map((record) => ({
        id: record.id,
        faceCount: record.faceCount,
        source: record.source,
        detectedAt: record.detectedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Unable to load attendance logs", error);
    return Response.json({ error: "Attendance logs are temporarily unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "A face count and source are required." }, { status: 400 });
  }

  const { faceCount, source } = body as { faceCount?: unknown; source?: unknown };
  if (
    typeof faceCount !== "number" ||
    !Number.isInteger(faceCount) ||
    faceCount < 0 ||
    faceCount > 1000
  ) {
    return Response.json({ error: "Face count must be a whole number between 0 and 1,000." }, { status: 400 });
  }

  if (source !== "camera" && source !== "photo") {
    return Response.json({ error: "Source must be camera or photo." }, { status: 400 });
  }

  try {
    const [record] = await db
      .insert(attendanceLogs)
      .values({ faceCount, source })
      .returning();

    return Response.json(
      {
        record: {
          id: record.id,
          faceCount: record.faceCount,
          source: record.source,
          detectedAt: record.detectedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Unable to save attendance log", error);
    return Response.json({ error: "This snapshot could not be saved." }, { status: 500 });
  }
}
