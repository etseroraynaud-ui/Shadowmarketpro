import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type SearchParams = {
  error?: string;
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/dashboard");

  const errorMsg = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-black text-white p-6">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-2xl border border-zinc-800">
        <h1 className="text-2xl font-semibold">Espace Affilié</h1>
        <p className="text-sm text-zinc-400 mt-2">
          Connecte-toi pour voir tes ventes et commissions.
        </p>

        {errorMsg ? (
          <div className="mt-4 rounded-xl border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {errorMsg}
          </div>
        ) : null}

        <form action="/auth/login" method="post" className="mt-6 space-y-4">
          <div>
            <label className="text-sm text-zinc-400">Email</label>
            <input
              name="email"
              type="email"
              required
              className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:border-white"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="text-sm text-zinc-400">Mot de passe</label>
            <input
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 focus:outline-none focus:border-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-white text-black rounded-lg py-2 font-medium hover:opacity-90 transition"
          >
            Se connecter
          </button>
        </form>
      </div>
    </div>
  );
}
