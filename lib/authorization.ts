import { auth } from "@/auth";
import { NextResponse } from "next/server";

export type AuthorizedUser = {
  email: string;
  name: string | null;
  image: string | null;
};

function getAllowedEmails(): Set<string> {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function getAuthorizedUser(): Promise<AuthorizedUser | null> {
  const session = await auth();

  if (!session?.user) {
    return null;
  }

  const email = session.user.email
    ?.trim()
    .toLowerCase();

  if (!email) {
    return null;
  }

  const allowedEmails = getAllowedEmails();

  if (!allowedEmails.has(email)) {
    return null;
  }

  return {
    email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
  };
}

export async function requireAuthorizedUser(): Promise<
  | {
      authorized: true;
      user: AuthorizedUser;
    }
  | {
      authorized: false;
      response: NextResponse;
    }
> {
  const user = await getAuthorizedUser();

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          success: false,
          error:
            "Bạn chưa đăng nhập hoặc không có quyền truy cập.",
        },
        {
          status: 401,
        }
      ),
    };
  }

  return {
    authorized: true,
    user,
  };
}
