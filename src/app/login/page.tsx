"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function fazerLogin(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });

    setCarregando(false);

    if (error) {
      setMensagem("E-mail ou senha incorretos. Tente de novo.");
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4efe6] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <p className="text-center text-sm font-medium text-orange-600">Rota Certa</p>
        <h1 className="text-2xl font-bold text-center mb-1">Entrar</h1>
        <p className="text-center text-stone-500 mb-6">Acesse o painel da sua empresa</p>

        <form onSubmit={fazerLogin} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2"
              placeholder="seu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Senha</label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-3 py-2"
              placeholder="Sua senha"
            />
          </div>

          {mensagem && <p className="text-sm text-red-600">{mensagem}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full bg-orange-500 text-white rounded-lg py-2.5 font-medium disabled:opacity-60"
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-600 mt-4">
          Ainda não tem conta?{" "}
          <a href="/cadastro" className="underline">
            Criar cadastro
          </a>
        </p>
      </div>
    </main>
  );
}