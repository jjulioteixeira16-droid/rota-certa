"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CadastroPage() {
  const router = useRouter();
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setCarregando(true);

    try {
      const { data, error: erroAuth } = await supabase.auth.signUp({
        email: email.trim(),
        password: senha,
        options: {
          data: {
            company_name: nomeEmpresa.trim(),
            full_name: nome.trim(),
          },
        },
      });

      if (erroAuth) {
        setMensagem(erroAuth.message);
        return;
      }

      const user = data.user;
      if (!user) {
        setMensagem("Conta criada, mas o usuário não veio. Tente fazer login.");
        return;
      }

      if (!data.session) {
        const { error: erroLogin } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: senha,
        });
        if (erroLogin) {
          setMensagem(
            "Conta criada, mas não deu para entrar agora. Vá em /login."
          );
          return;
        }
      }

      const { data: empresa, error: erroEmpresa } = await supabase
        .from("companies")
        .insert({
          name: nomeEmpresa.trim(),
          owner_id: user.id,
        })
        .select("id")
        .single();

      if (erroEmpresa) {
        setMensagem(erroEmpresa.message);
        return;
      }

      const { error: erroPerfil } = await supabase.from("profiles").insert({
        id: user.id,
        company_id: empresa.id,
        full_name: nome.trim(),
        role: "owner",
      });

      if (erroPerfil) {
        setMensagem(erroPerfil.message);
        return;
      }

      router.push("/dashboard");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4efe6] p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
        <p className="text-sm font-medium text-orange-600">Rota Certa</p>
        <h1 className="text-2xl font-bold mb-1">Criar conta</h1>
        <p className="text-stone-500 mb-6">Comece a usar o sistema da sua empresa</p>

        <form onSubmit={criarConta} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Nome da empresa</label>
            <input
              required
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Seu nome</label>
            <input
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Senha (mínimo 6 caracteres)</label>
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </div>

          {mensagem && <p className="text-sm text-red-600">{mensagem}</p>}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-lg bg-orange-500 py-2.5 font-medium text-white disabled:opacity-60"
          >
            {carregando ? "Criando..." : "Criar conta"}
          </button>
        </form>

        <p className="text-center text-sm text-stone-600 mt-4">
          Já tem conta?{" "}
          <a href="/login" className="underline">
            Fazer login
          </a>
        </p>
      </div>
    </main>
  );
}