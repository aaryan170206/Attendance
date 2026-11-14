
import { withSupabase } from "@supabase/server";

// Generate a cryptographically secure 64-character token.
function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

// Convert token into SHA-256 hash.
async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hash = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export default {
  fetch: withSupabase(
    { auth: "user" },
    async (req, ctx) => {
      // 1. Allow POST requests only.
      if (req.method !== "POST") {
        return Response.json(
          { error: "Method not allowed." },
          { status: 405 }
        );
      }

      // 2. Verify authenticated user.
      const userId = ctx.userClaims?.id;

      if (!userId) {
        return Response.json(
          { error: "Authentication required." },
          { status: 401 }
        );
      }

      // 3. Parse and validate request body.
      let body: unknown;

      try {
        body = await req.json();
      } catch {
        return Response.json(
          { error: "Invalid JSON request body." },
          { status: 400 }
        );
      }

      if (
        typeof body !== "object" ||
        body === null ||
        Array.isArray(body)
      ) {
        return Response.json(
          { error: "Invalid request body." },
          { status: 400 }
        );
      }

      const input = body as Record<string, unknown>;

      if (
        typeof input.institutionId !== "string" ||
        typeof input.fullName !== "string" ||
        typeof input.email !== "string" ||
        typeof input.role !== "string"
      ) {
        return Response.json(
          { error: "All fields are required and must be valid strings." },
          { status: 400 }
        );
      }

      const institutionId = input.institutionId.trim();
      const fullName = input.fullName.trim();
      const email = input.email.trim().toLowerCase();
      const role = input.role;

      // 4. Validate required fields.
      if (!institutionId || !fullName || !email || !role) {
        return Response.json(
          { error: "All fields are required." },
          { status: 400 }
        );
      }

      // Validate institution UUID.
      if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
          .test(institutionId)
      ) {
        return Response.json(
          { error: "Invalid institution ID." },
          { status: 400 }
        );
      }

      // Validate full name.
      if (fullName.length > 150) {
        return Response.json(
          { error: "Full name is too long." },
          { status: 400 }
        );
      }

      // Validate email.
      if (
        email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      ) {
        return Response.json(
          { error: "Invalid email address." },
          { status: 400 }
        );
      }

      // Only student and teacher invitations are allowed.
      if (role !== "student" && role !== "teacher") {
        return Response.json(
          { error: "Role must be student or teacher." },
          { status: 400 }
        );
      }

      // 5. Verify institution admin permission.
      const { data: isAdmin, error: permissionError } =
        await ctx.supabase.rpc("is_institution_admin", {
          target_institution_id: institutionId,
        });

      if (permissionError) {
        console.error(
          "Admin permission check failed:",
          permissionError
        );

        return Response.json(
          { error: "Could not verify institution permissions." },
          { status: 500 }
        );
      }

      if (isAdmin !== true) {
        return Response.json(
          {
            error:
              "You are not authorized to invite members to this institution.",
          },
          { status: 403 }
        );
      }

      // 6. Find an existing Auth user by email.
      const { data: existingUserId, error: userLookupError } =
        await ctx.supabaseAdmin.rpc(
          "lookup_auth_user_id_by_email",
          {
            target_email: email,
          }
        );

      if (userLookupError) {
        console.error("User lookup failed:", userLookupError);

        return Response.json(
          { error: "Could not verify the invited user's account." },
          { status: 500 }
        );
      }

      // 7. Check existing institution membership.
      if (existingUserId) {
        const { data: membership, error: membershipError } =
          await ctx.supabaseAdmin
            .from("institution_memberships")
            .select("id, status, role")
            .eq("institution_id", institutionId)
            .eq("user_id", existingUserId)
            .maybeSingle();

        if (membershipError) {
          console.error(
            "Membership lookup failed:",
            membershipError
          );

          return Response.json(
            { error: "Could not verify existing membership." },
            { status: 500 }
          );
        }

        if (membership?.status === "active") {
          return Response.json(
            {
              error:
                "This user is already an active member of this institution.",
            },
            { status: 409 }
          );
        }

        if (membership?.status === "invited") {
          return Response.json(
            {
              error:
                "This user already has an invitation or pending membership.",
            },
            { status: 409 }
          );
        }

        if (membership?.status === "suspended") {
          return Response.json(
            {
              error:
                "This user's membership is suspended. Reactivate it through institution member management.",
            },
            { status: 409 }
          );
        }
      }

      // 8. Check for an existing pending invitation.
      const {
        data: existingInvitation,
        error: invitationLookupError,
      } = await ctx.supabaseAdmin
        .from("institution_invitations")
        .select("id, expires_at")
        .eq("institution_id", institutionId)
        .eq("email", email)
        .eq("status", "pending")
        .maybeSingle();

      if (invitationLookupError) {
        console.error(
          "Invitation lookup failed:",
          invitationLookupError
        );

        return Response.json(
          { error: "Could not check existing invitations." },
          { status: 500 }
        );
      }

      if (existingInvitation) {
        const invitationExpiry = new Date(
          existingInvitation.expires_at
        );

        if (invitationExpiry.getTime() > Date.now()) {
          return Response.json(
            {
              error:
                "A pending invitation already exists for this email address.",
            },
            { status: 409 }
          );
        }

        // Mark expired invitation.
        const { error: expiryError } = await ctx.supabaseAdmin
          .from("institution_invitations")
          .update({ status: "expired" })
          .eq("id", existingInvitation.id)
          .eq("status", "pending");

        if (expiryError) {
          console.error(
            "Invitation expiry update failed:",
            expiryError
          );

          return Response.json(
            { error: "Could not update expired invitation." },
            { status: 500 }
          );
        }
      }

      // 9. Generate secure token.
      const token = generateToken();
      const tokenHash = await hashToken(token);

      const createdAt = new Date();

      // Invitation expires after seven days.
      const expiresAt = new Date(
        createdAt.getTime() + 7 * 24 * 60 * 60 * 1000
      );

      // 10. Insert invitation.
      const { data: invitation, error: insertError } =
        await ctx.supabaseAdmin
          .from("institution_invitations")
          .insert({
            institution_id: institutionId,
            full_name: fullName,
            email,
            role,
            token_hash: tokenHash,
            status: "pending",
            invited_by: userId,
            created_at: createdAt.toISOString(),
            expires_at: expiresAt.toISOString(),
          })
          .select(
            "id, institution_id, full_name, email, role, status, created_at, expires_at"
          )
          .single();

      if (insertError) {
        console.error(
          "Invitation creation failed:",
          insertError
        );

        // Unique index prevents duplicate pending invitations.
        if (insertError.code === "23505") {
          return Response.json(
            {
              error:
                "A pending invitation already exists for this email address.",
            },
            { status: 409 }
          );
        }

        return Response.json(
          { error: "Could not create the invitation." },
          { status: 500 }
        );
      }

      // 11. Return raw token once.
      return Response.json(
        {
          success: true,
          message: "Invitation created successfully.",
          invitation,
          token,
        },
        { status: 201 }
      );
    }
  ),
};
