import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const ANONYMOUS_SESSION_KEY = "zyon_anonymous_session";

export const useAnonymousSession = () => {
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeSession();
  }, []);

  const initializeSession = async () => {
    // Check for existing anonymous session in localStorage
    const stored = localStorage.getItem(ANONYMOUS_SESSION_KEY);
    
    if (stored) {
      const parsed = JSON.parse(stored);
      setSessionToken(parsed.token);
      setSessionId(parsed.sessionId);
      setLoading(false);
      return;
    }

    // Create new anonymous session
    const token = crypto.randomUUID();
    
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert({
        session_token: token,
        is_anonymous: true,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating anonymous session:", error);
      setLoading(false);
      return;
    }

    const newSession = {
      token,
      sessionId: data.id,
    };

    localStorage.setItem(ANONYMOUS_SESSION_KEY, JSON.stringify(newSession));
    setSessionToken(token);
    setSessionId(data.id);
    setLoading(false);
  };

  const clearAnonymousSession = () => {
    localStorage.removeItem(ANONYMOUS_SESSION_KEY);
    setSessionToken(null);
    setSessionId(null);
  };

  return {
    sessionToken,
    sessionId,
    loading,
    clearAnonymousSession,
  };
};
