import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Every admin page calls this in addition to app/admin/layout.tsx calling it
// once already — without cache(), that's two round trips to Supabase Auth
// (auth.getUser() intentionally revalidates against the server, it doesn't
// just decode the cookie) plus two profile selects, on every single
// navigation. cache() memoizes this per request so the layout and the page
// share one result instead of fetching it twice.
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
});
