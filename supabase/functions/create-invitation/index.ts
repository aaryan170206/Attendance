
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (_req, ctx) => {
      // Get the authenticated user's information.
      const userId = ctx.userClaims?.id;
      const userEmail = ctx.userClaims?.email;

      if (!userId) {
        return Response.json(
          { error: "User authentication required." },
          { status: 401 }
        );
      }

      // Temporary test response.
      return Response.json({
        success: true,
        message: "Authenticated successfully.",
        user: {
          id: userId,
          email: userEmail,
        },
      });
    }
  ),
};
