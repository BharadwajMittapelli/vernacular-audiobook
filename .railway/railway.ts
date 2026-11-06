import { defineRailway, github, project, service } from "railway/iac";
// This repository manages only its own resources in the environment. Other
// repositories export their own partial name.
// See https://docs.railway.com/infrastructure-as-code#multi-repo-projects
export const partial = "vernacular-audiobook";
export default defineRailway(() => {
  const vernacularAudiobook = service("vernacular-audiobook", {
    source: github("BharadwajMittapelli/vernacular-audiobook", { branch: "master", checkSuites: false, upstreamUrl: "https://github.com/BharadwajMittapelli/vernacular-audiobook" }),
    build: { buildCommand: "cd server && npm install", buildEnvironment: "V3", builder: "RAILPACK" },
    start: "cd server && npm start",
    healthcheck: "/health",
    healthcheckTimeout: 300,
    replicas: { "sfo": 1 },
  });

  return project("celebrated-endurance", {
    variables: { managed: false },
    resources: [vernacularAudiobook],
  });
});
