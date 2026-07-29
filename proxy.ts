import { auth } from "@/auth";
import { NextResponse } from "next/server";

export const proxy = auth((request) => {
  const { pathname, search } =
    request.nextUrl;

  const isLoggedIn =
    Boolean(request.auth?.user?.email);

  if (!isLoggedIn) {
    const loginUrl =
      new URL("/login", request.url);

    loginUrl.searchParams.set(
      "callbackUrl",
      `${pathname}${search}`
    );

    return NextResponse.redirect(
      loginUrl
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)",
  ],
};