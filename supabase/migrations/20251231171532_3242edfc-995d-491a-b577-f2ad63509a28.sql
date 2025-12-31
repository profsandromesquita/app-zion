-- Add title column to chat_sessions for displaying chat titles
ALTER TABLE public.chat_sessions 
ADD COLUMN title TEXT DEFAULT 'Nova Conversa';