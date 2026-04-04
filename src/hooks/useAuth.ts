import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [telegramUser, setTelegramUser] = useState<TelegramUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
      } else {
        authenticateViaTelegram();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const authenticateViaTelegram = async () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      const initData = tg?.initData;

      if (!initData) {
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/telegram-auth`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_KEY,
          },
          body: JSON.stringify({ initData }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("Telegram auth failed:", data.error);
        setLoading(false);
        return;
      }

      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        setTelegramUser(data.telegram_user);
      }
    } catch (err) {
      console.error("Telegram auth error:", err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (login: string, password: string) => {
    // If user types just "admin", convert to full email
    const email = login.includes("@") ? login : `${login}@elkihome.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, telegramUser, loading, signIn, signOut };
}
