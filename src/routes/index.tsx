import { createFileRoute } from "@tanstack/react-router";
import { WorldExperience } from "@/world/WorldExperience";

const title = "Spor — A Quiet Nordic Forest";
const description =
  "Wander as a fox through a calm Nordic forest. Leave stones, flowers, lanterns and weather for someone else to find.";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WorldExperience,
});
