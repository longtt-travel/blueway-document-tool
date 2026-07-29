import { auth, signIn } from "@/auth";
import { redirect } from "next/navigation";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user?.email) {
    redirect("/");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background:
          "linear-gradient(135deg, #edf6ff, #ffffff)",
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 430,
          padding: 36,
          borderRadius: 24,
          background: "#ffffff",
          border: "1px solid #dbe8f6",
          boxShadow:
            "0 20px 60px rgba(31, 78, 121, 0.15)",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            margin: "0 auto 20px",
            display: "grid",
            placeItems: "center",
            borderRadius: 18,
            background: "#1472c9",
            color: "#ffffff",
            fontSize: 30,
            fontWeight: 800,
          }}
        >
          B
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 28,
            color: "#173c61",
          }}
        >
          Blueway Document Tool
        </h1>

        <p
          style={{
            margin: "14px 0 28px",
            color: "#60778d",
            lineHeight: 1.6,
          }}
        >
          Đăng nhập bằng tài khoản Google đã được cấp quyền.
        </p>

        <form
          action={async () => {
            "use server";

            await signIn("google", {
              redirectTo: "/",
            });
          }}
        >
          <button
            type="submit"
            style={{
              width: "100%",
              height: 50,
              border: 0,
              borderRadius: 14,
              background: "#1472c9",
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Đăng nhập bằng Google
          </button>
        </form>

        <p
          style={{
            margin: "20px 0 0",
            color: "#8798a8",
            fontSize: 13,
          }}
        >
          Chỉ email nằm trong danh sách được phép mới đăng nhập được.
        </p>
      </section>
    </main>
  );
}