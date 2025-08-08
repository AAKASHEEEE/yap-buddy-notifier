import { Button } from "@/components/ui/button";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <header className="container py-10">
        <nav className="flex items-center justify-between">
          <div className="text-lg font-semibold">Kaito Yaps Overlay</div>
          <div className="flex gap-3">
            <a href="#setup" className="text-sm text-muted-foreground hover:text-foreground">Setup</a>
            <a href="#security" className="text-sm text-muted-foreground hover:text-foreground">Security</a>
          </div>
        </nav>
      </header>
      <main>
        <section className="container py-16">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">Kaito Yaps Overlay — Yap score badges for X/Twitter</h1>
            <p className="text-lg text-muted-foreground mb-8">A privacy-first Chrome extension that shows Kaito Yap scores inline beside usernames on X/Twitter. Caching, batching, and graceful failure built-in.</p>
            <div className="flex items-center justify-center gap-3">
              <a href="#setup">
                <Button variant="hero" size="lg">Get Started</Button>
              </a>
              <a href="https://api.kaito.ai/" target="_blank" rel="noreferrer">
                <Button variant="outline" size="lg">Kaito API</Button>
              </a>
            </div>
          </div>
        </section>
        <section id="setup" className="container py-12">
          <h2 className="text-2xl font-semibold mb-4">Quick setup</h2>
          <ol className="list-decimal pl-5 space-y-2 text-muted-foreground">
            <li>Set your Supabase Edge Function URL in the extension popup (e.g. https://YOUR-PROJECT.supabase.co/functions/v1/get-yap).</li>
            <li>Toggle “Enable badges” and pick your cache TTL.</li>
            <li>Visit x.com — badges will appear within seconds and on scroll.</li>
          </ol>
        </section>
        <section id="security" className="container py-12">
          <h2 className="text-2xl font-semibold mb-4">Security & privacy</h2>
          <p className="text-muted-foreground">No cookies or page content are sent. Only usernames are proxied through the backend with caching and rate limiting. The edge function exposes CORS safely and supports optional API keys via secrets.</p>
        </section>
      </main>
      <footer className="container py-10 text-sm text-muted-foreground">© {new Date().getFullYear()} Kaito Yaps Overlay</footer>
    </div>
  );
};

export default Index;
