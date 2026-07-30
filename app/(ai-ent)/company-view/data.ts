// The Shell fixture loader moved to lib/shell-fixture.ts on 30 July 2026 so
// the top-level Assess and Decide module can share it under the modules-
// import-only-from-lib rule. This re-export keeps existing tab imports.
export * from "@/lib/shell-fixture";
