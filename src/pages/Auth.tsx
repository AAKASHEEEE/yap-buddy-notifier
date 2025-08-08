import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useAuthSession } from "@/hooks/useAuthSession";

const Auth = () => {
  const { user, signInWithTwitter } = useAuthSession();

  useEffect(() => {
    document.title = "Sign in with Twitter | Kaito Yaps";
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="container py-10">
        <h1 className="text-3xl font-bold">Sign in to Kaito Yaps</h1>
      </header>
      <main className="container pb-20">
        <section className="max-w-md mx-auto">
          <p className="text-muted-foreground mb-6">Authenticate using your Twitter account. We only use it to identify you in the app.</p>
          <Button size="lg" onClick={() => signInWithTwitter()}>
            Continue with Twitter
          </Button>
          {user && (
            <p className="mt-4 text-sm text-muted-foreground">You're already signed in.</p>
          )}
        </section>
      </main>
    </div>
  );
};

export default Auth;
