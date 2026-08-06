import { cookies } from "next/headers";
import { parseProfile, PROFILE_COOKIE, type DeskProfile } from "./profile";

// Reading the reader's desk on the server.
//
// Split from the client module so a server component can import this without
// dragging a "use client" boundary and its React hooks into the server graph.
// Same cookie, same parser, one definition of what a valid profile is.

export async function readDeskProfile(): Promise<DeskProfile | null> {
  const jar = await cookies();
  return parseProfile(jar.get(PROFILE_COOKIE)?.value);
}

export type { DeskProfile };
