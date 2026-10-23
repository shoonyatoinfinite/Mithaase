import { eventEmitter, RealtimeEventPayload } from "@/lib/events/broadcast";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 1. Initial connection established message
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: "connected", timestamp: new Date().toISOString() })}\n\n`)
      );

      // 2. Listener for live broadcast events
      const onEvent = (payload: RealtimeEventPayload) => {
        try {
          controller.enqueue(
            encoder.encode(`event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`)
          );
        } catch (err) {
          // Stream might have closed
        }
      };

      eventEmitter.on("realtime_event", onEvent);

      // 3. Heartbeat ping every 15s to keep SSE connection alive
      const intervalId = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch (err) {
          clearInterval(intervalId);
        }
      }, 15000);

      // 4. Cleanup on disconnect
      req.signal.addEventListener("abort", () => {
        eventEmitter.off("realtime_event", onEvent);
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // Closed already
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
