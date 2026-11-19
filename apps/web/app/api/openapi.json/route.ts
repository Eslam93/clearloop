import { NextResponse } from "next/server";
import { openApiDocument } from "@/lib/api/openapi";

export function GET(request: Request) {
  return NextResponse.json(openApiDocument(new URL(request.url).origin));
}
