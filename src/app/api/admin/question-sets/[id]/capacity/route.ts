import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabaseServer";
import {
  getAdminCookieName,
  verifyAdminSessionCookieValue,
} from "@/lib/adminAuth";

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function toInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const intValue = Math.trunc(value);
  return intValue === value ? intValue : null;
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(getAdminCookieName())?.value;
  if (!verifyAdminSessionCookieValue(sessionCookie)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resolvedParams = await context.params;
  const questionSetId = resolvedParams.id;
  if (!isUuid(questionSetId)) {
    return NextResponse.json(
      { error: "잘못된 질문 ID입니다." },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 본문을 읽을 수 없습니다." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const bodyObj = body as {
    delta?: unknown;
    capacity?: unknown;
  };

  const supabase = getSupabaseServerClient();

  // 현재 capacity & assignedCount를 조회해 안전하게 변경합니다.
  const { data: setRow, error: setError } = await supabase
    .from("question_sets")
    .select("id, capacity")
    .eq("id", questionSetId)
    .maybeSingle();

  if (setError || !setRow) {
    return NextResponse.json(
      { error: "질문 정보를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { count: assignedCount, error: assignedCountError } = await supabase
    .from("question_selections")
    .select("user_id", { count: "exact", head: true })
    .eq("question_set_id", questionSetId);

  if (assignedCountError) {
    return NextResponse.json(
      { error: "할당 인원 집계를 실패했습니다." },
      { status: 500 },
    );
  }

  const currentCapacity: number = setRow.capacity;
  const safeAssignedCount = assignedCount ?? 0;

  let newCapacity: number | null = null;

  if ("delta" in bodyObj && bodyObj.delta !== undefined) {
    const deltaCandidate = toInteger(bodyObj.delta);
    if (deltaCandidate !== 1 && deltaCandidate !== -1) {
      return NextResponse.json(
        { error: "`delta`는 +1 또는 -1만 가능합니다." },
        { status: 400 },
      );
    }

    newCapacity = currentCapacity + deltaCandidate;
  } else if ("capacity" in bodyObj && bodyObj.capacity !== undefined) {
    const capacityCandidate = toInteger(bodyObj.capacity);
    if (capacityCandidate === null) {
      return NextResponse.json(
        { error: "`capacity`는 정수여야 합니다." },
        { status: 400 },
      );
    }
    newCapacity = capacityCandidate;
  } else {
    return NextResponse.json(
      { error: "`delta` 또는 `capacity`를 보내주세요." },
      { status: 400 },
    );
  }

  if (newCapacity === null) {
    return NextResponse.json(
      { error: "capacity 계산에 실패했습니다." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(newCapacity)) {
    return NextResponse.json(
      { error: "capacity 값이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  if (newCapacity < 1) {
    return NextResponse.json(
      { error: "capacity는 1 이상이어야 합니다." },
      { status: 400 },
    );
  }

  if (newCapacity < safeAssignedCount) {
    return NextResponse.json(
      {
        error: "capacity를 줄일 수 없습니다.",
        details: {
          assignedCount: safeAssignedCount,
          requestedCapacity: newCapacity,
        },
      },
      { status: 400 },
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("question_sets")
    .update({ capacity: newCapacity })
    .eq("id", questionSetId)
    .select("id, capacity")
    .maybeSingle();

  if (updateError || !updated) {
    return NextResponse.json(
      { error: "capacity 업데이트에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    id: updated.id,
    capacity: updated.capacity,
    assignedCount: safeAssignedCount,
    currentCapacity,
  });
}

