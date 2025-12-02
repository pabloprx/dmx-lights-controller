import { getLinkInstance, updateLinkState } from "../../utils/linkState";

export default defineEventHandler(async (event) => {
  const body = await readBody<{ tempo: number }>(event);

  if (!body?.tempo || typeof body.tempo !== "number") {
    throw createError({
      statusCode: 400,
      message: "Missing or invalid 'tempo' field. Must be a number.",
    });
  }

  if (body.tempo < 20 || body.tempo > 999) {
    throw createError({
      statusCode: 400,
      message: "Tempo must be between 20 and 999 BPM.",
    });
  }

  const link = getLinkInstance();
  if (!link) {
    throw createError({
      statusCode: 503,
      message: "Ableton Link is not initialized.",
    });
  }

  link.setTempo(body.tempo);
  updateLinkState({ tempo: body.tempo });

  return {
    success: true,
    tempo: body.tempo,
  };
});
