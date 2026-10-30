import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-[13px] font-semibold uppercase tracking-wider text-app-muted">404</p>
      <h1 className="mt-2 text-[28px] font-extrabold tracking-tight text-app-charcoal">We could not find that page</h1>
      <p className="mt-2 text-[15px] text-app-muted">It may have moved, or you may not have access to it.</p>
      <Link href="/" className="mt-6 rounded-full bg-app-charcoal px-5 py-2.5 text-[14px] font-semibold text-white">
        Back to home
      </Link>
    </main>
  );
}
