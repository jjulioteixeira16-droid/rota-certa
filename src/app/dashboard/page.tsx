"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [nomeEmpresa, setNomeEmpresa] = useState("");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [precisaEmpresa, setPrecisaEmpresa] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    async function iniciar() {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? null);
      setUserId(user.id);

      const { data: perfil } = await supabase
        .from("profiles")
        .select("company_id, companies(name)")
        .eq("id", user.id)
        .maybeSingle();

      if (perfil?.company_id) {
        setEmpresaId(perfil.company_id);
        const empresa = perfil.companies as { name?: string } | { name?: string }[] | null;
        const nome = Array.isArray(empresa) ? empresa[0]?.name : empresa?.name;
        setNomeEmpresa(nome ?? "");
        setPrecisaEmpresa(false);
        setCarregando(false);
        return;
      }

      const { data: empresaDona } = await supabase
        .from("companies")
        .select("id, name")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (empresaDona) {
        await supabase.from("profiles").insert({
          id: user.id,
          company_id: empresaDona.id,
          full_name: user.email ?? "Dono",
          role: "owner",
        });
        setEmpresaId(empresaDona.id);
        setNomeEmpresa(empresaDona.name);
        setPrecisaEmpresa(false);
        setCarregando(false);
        return;
      }

      setPrecisaEmpresa(true);
      setCarregando(false);
    }

    iniciar();
  }, [router]);

  async function salvarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;

    setMensagem("");
    setSalvando(true);

    const { data: empresa, error: erroEmpresa } = await supabase
      .from("companies")
      .insert({
        name: nomeEmpresa.trim(),
        owner_id: userId,
      })
      .select("id, name")
      .single();

    if (erroEmpresa || !empresa) {
      setMensagem(erroEmpresa?.message ?? "Não deu para salvar a empresa.");
      setSalvando(false);
      return;
    }

    const { error: erroPerfil } = await supabase.from("profiles").insert({
      id: userId,
      company_id: empresa.id,
      full_name: email ?? "Dono",
      role: "owner",
    });

    setSalvando(false);

    if (erroPerfil) {
      setMensagem(erroPerfil.message);
      return;
    }

    setEmpresaId(empresa.id);
    setPrecisaEmpresa(false);
  }

  async function sair() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (carregando) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </main>
    );
  }

  if (precisaEmpresa) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
        <form
          onSubmit={salvarEmpresa}
          className="w-full max-w-md bg-white rounded-2xl shadow p-6 space-y-4"
        >
          <h1 className="text-2xl font-bold">Sua empresa</h1>
          <p className="text-zinc-600">
            Seu login já existe. Agora vamos gravar o nome da lanchonete/padaria.
          </p>
          <input
            required
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            placeholder="Ex: Rushtedby"
            className="w-full border rounded-lg px-3 py-2"
          />
          {mensagem && <p className="text-sm text-red-600">{mensagem}</p>}
          <button
            disabled={salvando}
            className="w-full bg-black text-white rounded-lg py-2"
          >
            {salvando ? "Salvando..." : "Salvar empresa"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 p-6">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow p-6">
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-zinc-600 mb-6">
          Empresa: <strong>{nomeEmpresa || "—"}</strong>
          <br />
          Usuário: <strong>{email}</strong>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <a
            href="/bairros"
            className="bg-black text-white rounded-lg px-4 py-2 text-center"
          >
            Bairros e valores
          </a>
          <a
            href="/motoboys"
            className="bg-black text-white rounded-lg px-4 py-2 text-center"
          >
            Motoboys
          </a>
          <a
            href="/lancamentos"
            className="bg-black text-white rounded-lg px-4 py-2 text-center"
          >
            Lançamentos
          </a>
          <a
            href="/fechamento"
            className="bg-black text-white rounded-lg px-4 py-2 text-center"
          >
            Fechamento do dia
          </a>
        </div>

        <button onClick={sair} className="border rounded-lg px-4 py-2">
          Sair
        </button>
      </div>
    </main>
  );
}