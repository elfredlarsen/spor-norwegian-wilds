import { createOpenAI } from "@ai-sdk/openai";
import { createServerFn } from "@tanstack/react-start";
import { streamText } from "ai";
import { z } from "zod";

const journalInput = z.object({
  observation: z.string().trim().min(2).max(800),
});

export const createNatureJournalNote = createServerFn({ method: "POST" })
  .inputValidator((data) => journalInput.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Naturdagbogen kan ikke nå skoven lige nu.");

    const lovable = createOpenAI({
      baseURL: "https://ai.gateway.lovable.dev/v1",
      apiKey,
      headers: {
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "vercel-ai-sdk",
      },
    });

    try {
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        system:
          "Du skriver varme, rolige naturdagbogsnoter til børn og voksne. Svar på dansk med højst tre korte sætninger og 55 ord. Bevar personens konkrete fund og tone. Tilføj gerne ét nænsomt nordisk naturbillede, men opfind ikke fakta om fundet. Ingen råd, mål, point eller spørgsmål.",
        prompt: `Skriv en personlig naturdagbogsnote ud fra denne observation:\n\n${data.observation}`,
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
            include: ["reasoning.encrypted_content"],
          },
        },
        maxRetries: 0,
      });
      const text = (await result.text).trim();
      if (!text) throw new Error("Naturdagbogen fand ingen ord denne gang.");
      return { text };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Naturdagbogen kunne ikke skrives lige nu.";
      throw new Error(message);
    }
  });