export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#f4efe6] p-6">
      <div className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-sm p-8 text-center">
        <p className="text-sm font-medium text-orange-600 mb-2">Para lanchonetes e padarias</p>
        <h1 className="text-3xl font-bold mb-3">Rota Certa</h1>
        <p className="text-stone-600 mb-8">
          Controle motoboys, bairros, entregas e o fechamento do dia em um só lugar.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href="/login"
            className="bg-orange-500 text-white rounded-lg px-5 py-2.5 font-medium"
          >
            Entrar
          </a>
          <a
            href="/cadastro"
            className="border border-stone-300 rounded-lg px-5 py-2.5 font-medium"
          >
            Criar conta
          </a>
        </div>
      </div>
    </main>
  );
}